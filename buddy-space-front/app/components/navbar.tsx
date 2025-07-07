"use client"

import type React from "react"
import { useCallback, useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import api from "@/app/api"
import styles from "./navbar.module.css"
import ChatWindow from "./chat/chat-window"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export interface ChatRoom {
  roomId: number
  roomName: string
  roomType: "GROUP" | "DIRECT"
  groupId?: number
}

interface Notification {
  notificationId: number
  content: string
  groupName: string
  createdAt: string
  isRead: boolean
  url: string
}

export default function NavBar() {
  const [userInfo, setUserInfo] = useState<{ id: number; profileImageUrl?: string; [key: string]: any } | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationCount, setNotificationCount] = useState(0)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)

  const [currentPage, setCurrentPage] = useState(0)
  const [lastPage, setLastPage] = useState(false)
  // EventSource 상태는 useRef로 관리하는 게 안전합니다.
  const sseEventSourceRef = useRef<EventSource | null>(null)

  const notificationDropdownRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const router = useRouter()
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [activeChatWindow, setActiveChatWindow] = useState<ChatRoom | null>(null)
  const [isLoadingChats, setIsLoadingChats] = useState(true)

  const closeChatWindow = (roomId: number) => {
    if (activeChatWindow?.roomId === roomId) {
      setActiveChatWindow(null)
    }
  }
  const handleChatRoomClick = (room: ChatRoom) => {
    setActiveChatWindow(room)
  }
  const searchInputRef = useRef<HTMLInputElement>(null)

  const redirectToLogin = useCallback(() => {
    router.push("/login")
  }, [router])

  const logoutUser = useCallback(() => {
    localStorage.removeItem("accessToken")
    if (sseEventSourceRef.current) {
      sseEventSourceRef.current.close()
      sseEventSourceRef.current = null
    }
    router.push("/login")
  }, [router])

  // 채팅방 로드 함수 useCallback으로 메모이제이션
  const loadAllChatRooms = useCallback(async () => {
    setIsLoadingChats(true);
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) throw new Error("토큰이 없습니다.");

      const groupsRes = await fetch(`${API_BASE}/groups/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const groupsData = await groupsRes.json();
      const groups = Array.isArray(groupsData.result?.content)
          ? groupsData.result.content
          : [];

      const allRooms: ChatRoom[] = [];

      for (const group of groups) {
        const groupId = group.groupId || group.id;
        if (!groupId) continue;

        const chatRes = await fetch(
            `${API_BASE}/group/${groupId}/chat/rooms/my`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!chatRes.ok) continue;
        const chatData = await chatRes.json();
        if (!Array.isArray(chatData.result)) continue;

        const detailedRooms = await Promise.all(
            chatData.result.map(async (room: any) => {
              const detailRes = await fetch(
                  `${API_BASE}/group/${groupId}/chat/rooms/${room.roomId}`,
                  { headers: { Authorization: `Bearer ${token}` } }
              );
              if (!detailRes.ok) throw new Error("채팅방 상세 조회 실패");

              const detailData = await detailRes.json();
              return {
                roomId: detailData.result.roomId,
                roomName: detailData.result.name,
                roomType: detailData.result.type,
                groupId,
              } as ChatRoom;
            })
        );

        allRooms.push(...detailedRooms);
      }

      setChatRooms(allRooms);
    } catch (err) {
      console.error("채팅방 로드 실패:", err);
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  // 알림 불러오기 함수 useCallback으로 감싸기
  const fetchNotifications = useCallback(async (page = 0) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return { content: [], last: true, number: 0 };
    try {
      const response = await api.get(`/notifications?page=${page}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data.result;
    } catch (error) {
      console.error("알림 목록 요청 중 오류:", error);
      return { content: [], last: true, number: 0 };
    }
  }, []);

  // 초기 알림 불러오기
  const loadInitialNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    const data = await fetchNotifications(0);
    setNotifications(data.content);
    setLastPage(data.last);
    setCurrentPage(data.number + 1);
    const unreadCount = data.content.filter((n: Notification) => !n.isRead).length;
    setNotificationCount(unreadCount);
    setIsLoadingNotifications(false);
  }, [fetchNotifications]);

  // 추가 알림 불러오기
  const loadMoreNotifications = useCallback(async () => {
    if (lastPage || isLoadingNotifications) return;
    setIsLoadingNotifications(true);
    const data = await fetchNotifications(currentPage);
    setNotifications(prev => [...prev, ...data.content]);
    setLastPage(data.last);
    setCurrentPage(data.number + 1);
    setIsLoadingNotifications(false);
  }, [currentPage, fetchNotifications, isLoadingNotifications, lastPage]);

  // SSE 연결 함수
  const connectNotificationSSE = useCallback(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    // 기존 연결 닫기
    if (sseEventSourceRef.current) {
      sseEventSourceRef.current.close();
      sseEventSourceRef.current = null;
    }

    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem('clientId', clientId);
    }

    const newEventSource = new EventSource(
        `${API_BASE}/notifications/subscribe?clientId=${clientId}`,
        { withCredentials: true }
    );

    newEventSource.onopen = () => {
      console.log("SSE 연결 성공");
    };

    newEventSource.addEventListener("notification", async (event) => {
      const notification = JSON.parse(event.data);
      console.log("새 알림 도착:", notification);
      await loadInitialNotifications();
    });

    newEventSource.onerror = (event) => {
      console.error("SSE 연결 오류 또는 종료", event);
      newEventSource.close();
      sseEventSourceRef.current = null;
      setTimeout(() => {
        connectNotificationSSE();
      }, 5000);
    };

    sseEventSourceRef.current = newEventSource;
  }, [loadInitialNotifications]);

  // useEffect - 마운트 시 유저 정보, 채팅방, SSE 연결
  useEffect(() => {
    if (!localStorage.getItem("accessToken")) {
      redirectToLogin();
      return;
    }

    const fetchUser = async () => {
      try {
        const res = await api.get("/users/me", { withCredentials: true });
        setUserInfo(res.data.result);
      } catch (err: any) {
        console.error("유저 정보 오류:", err);
        redirectToLogin();
      }
    };

    fetchUser();
    loadAllChatRooms();
    connectNotificationSSE();

    return () => {
      if (sseEventSourceRef.current) {
        sseEventSourceRef.current.close();
        sseEventSourceRef.current = null;
      }
    };
  }, [connectNotificationSSE, loadAllChatRooms, redirectToLogin]);

  // IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadMoreNotifications();
          }
        },
        { threshold: 1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [loadMoreNotifications]);

  // 시간 표시 함수
  const formatNotificationTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffHours < 24) {
      return `${diffHours}시간 전`;
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
    }
  };

  // 알림 URL 변환
  const convertApiUrlToPageUrl = (apiUrl: string) => {
    const postMatch = apiUrl.match(/^\/api\/groups\/(\d+)\/posts\/(\d+)$/);
    if (postMatch) {
      const groupId = postMatch[1];
      const postId = postMatch[2];
      return `/meeting/group/${groupId}/post/${postId}`;
    }
    return apiUrl;
  };

  // 알림 클릭 핸들러
  const handleNotificationClick = async (notification: Notification) => {
    const { notificationId, url, isRead } = notification;
    if (!isRead) {
      try {
        await api.patch(`/notifications/${notificationId}/read`, {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` }
        });
        setNotifications(prev =>
            prev.map(n => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
        );
        setNotificationCount(prev => (prev > 0 ? prev - 1 : 0));
      } catch (error) {
        console.error("알림 읽음 처리 실패:", error);
      }
    }
    const pageUrl = convertApiUrlToPageUrl(url);
    router.push(pageUrl);
  };

  const handleSearch = () => {
    const keyword = searchInputRef.current?.value.trim();
    if (keyword) {
      router.push(`/search?keyword=${encodeURIComponent(keyword)}`);
    }
  };

  return (
      <>
        <nav className={styles.navbar}>
          <a href="/meeting" className={styles.logoSection}>
            <img
                src="https://raw.githubusercontent.com/withong/my-storage/main/budderz/free-icon-wing-12298574.png"
                alt="벗터 로고"
                className={styles.logoImage}
            />
          </a>

          <div className={styles.searchSection}>
            <div className={styles.searchContainer}>
              <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="모임 이름 검색"
                  className={styles.searchInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
              />
              <button className={styles.searchButton} onClick={handleSearch}>
                검색
              </button>
            </div>
          </div>

          <div className={styles.navSection}>
            <Dropdown
                icon="https://raw.githubusercontent.com/withong/my-storage/main/budderz/free-icon-notification-bell-8377307.png"
                alt="알림"
                badge={notificationCount}
                onOpen={loadInitialNotifications}
                content={
                  <div className={styles.notificationDropdown} ref={notificationDropdownRef}>
                    <div className={styles.notificationHeader}>
                      <h3>알림</h3>
                    </div>
                    {isLoadingNotifications && notifications.length === 0 ? (
                        <div className={styles.loadingMessage}>알림을 불러오는 중...</div>
                    ) : notifications.length === 0 ? (
                        <div className={styles.emptyMessage}>알림이 없습니다</div>
                    ) : (
                        <div className={styles.notificationList}>
                          {notifications.map((notification) => (
                              <div
                                  key={notification.notificationId}
                                  className={`${styles.notificationItem} ${notification.isRead ? '' : styles.unread}`}
                                  onClick={() => handleNotificationClick(notification)}
                              >
                                <div className={styles.notificationContent}>
                                  <div className={styles.notificationText}>{notification.content}</div>
                                  <div className={styles.notificationMeta}>
                                    <span className={styles.groupName}>{notification.groupName}</span>
                                    <span className={styles.notificationTime}>
                              {formatNotificationTime(notification.createdAt)}
                            </span>
                                  </div>
                                </div>
                              </div>
                          ))}
                          <div ref={sentinelRef} style={{ height: "1px" }} />
                        </div>
                    )}
                  </div>
                }
            />

            <div className={styles.navSection}>
              <Dropdown
                  icon="https://raw.githubusercontent.com/withong/my-storage/main/budderz/free-icon-conversation-5323491.png"
                  alt="채팅"
                  badge={0}
                  content={
                    <div className={styles.chatDropdown}>
                      <div className={styles.chatHeader}>
                        <h3>채팅</h3>
                      </div>

                      {isLoadingChats ? (
                          <div className={styles.loadingMessage}>채팅방을 불러오는 중...</div>
                      ) : chatRooms.length === 0 ? (
                          <div className={styles.emptyMessage}>채팅 내역이 없습니다</div>
                      ) : (
                          <div className={styles.chatList}>
                            {chatRooms.map((room) => (
                                <div
                                    key={room.roomId}
                                    className={styles.chatItem}
                                    onClick={() => handleChatRoomClick(room)}
                                >
                                  <div className={styles.chatItemContent}>
                                    <div className={styles.chatItemHeader}>
                              <span className={styles.chatRoomName}>
                                {`${room.roomType === "GROUP" ? "🏠" : "💬"} ${room.roomName}`}
                              </span>
                                    </div>
                                  </div>
                                </div>
                            ))}
                          </div>
                      )}
                    </div>
                  }
              />
            </div>

            <Dropdown
                icon={
                    userInfo?.profileImageUrl ||
                    "https://raw.githubusercontent.com/withong/my-storage/main/budderz/default.png"
                }
                alt="프로필"
                className={styles.profileImage}
                content={
                  <>
                    <div className={styles.dropdownItem} onClick={() => router.push("/profile")}>
                      👤 내 정보 조회
                    </div>
                    <div className={styles.dropdownItem} onClick={logoutUser}>
                      🚪 로그아웃
                    </div>
                  </>
                }
            />
          </div>
        </nav>

        {/* 채팅 창 */}
        {activeChatWindow && userInfo && activeChatWindow.groupId != null && (
            <ChatWindow
                roomId={activeChatWindow.roomId}
                roomName={activeChatWindow.roomName}
                roomType={activeChatWindow.roomType}
                groupId={activeChatWindow.groupId}
                currentUserId={userInfo.id}
                onClose={() => {
                  closeChatWindow(activeChatWindow.roomId);
                  loadAllChatRooms();
                }}
            />
        )}
        {activeChatWindow && !activeChatWindow.groupId && (
            <div className={styles.chatError}>
              그룹 ID가 없어 채팅을 불러올 수 없습니다.
            </div>
        )}
      </>
  )
}

interface DropdownProps {
  icon: string
  alt: string
  content: React.ReactNode
  className?: string
  badge?: number
  onOpen?: () => void
}

function Dropdown({ icon, alt, content, className, badge, onOpen }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && onOpen) {
      onOpen()
    }
    setOpen((prev) => !prev)
  }

  return (
      <div className={styles.dropdownWrapper} ref={dropdownRef}>
        <div className={styles.iconContainer}>
          <img
              src={icon || "/placeholder.svg"}
              alt={alt}
              className={className || styles.navIcon}
              onClick={handleToggle}
          />
          {badge && badge > 0 && <span className={styles.badge}>{badge > 99 ? "99+" : badge}</span>}
        </div>
        {open && (
            <div className={`${styles.dropdownMenu} ${styles.show}`} onClick={(e) => e.stopPropagation()}>
              {content}
            </div>
        )}
      </div>
  )
}
