"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import api from "@/app/api"
import ChatWindow from "./chat/chat-window"
import styles from "./navbar.module.css"

interface ChatRoom {
  roomId: number
  roomName: string
  roomType: "GROUP" | "DIRECT"
  lastMessage?: string
  lastMessageTime?: string
  unreadCount: number
  groupId?: number
  otherUser?: {
    userId: number
    userName: string
    profileImageUrl?: string
  }
}

interface Notification {
  content: string
  groupName: string
  createdAt: string
}

export default function NavBar() {
  const [userInfo, setUserInfo] = useState<{ id: number; profileImageUrl?: string;[key: string]: any } | null>(null)
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationCount, setNotificationCount] = useState(0)
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [openChatWindows, setOpenChatWindows] = useState<Set<number>>(new Set())
  const [activeChatWindow, setActiveChatWindow] = useState<ChatRoom | null>(null)

  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const redirectToLogin = () => {
    router.push("/login")
  }

  const logoutUser = () => {
    localStorage.removeItem("accessToken")
    router.push("/login")
  }

  const handleSearch = () => {
    const keyword = searchInputRef.current?.value.trim()
    if (keyword) {
      router.push(`/search?keyword=${encodeURIComponent(keyword)}`)
    }
  }

  async function getAuthHeaders(): Promise<{ Authorization: string; "Content-Type": string }> {
    const token = localStorage.getItem("accessToken")
    if (!token) {
      throw new Error("토큰이 없습니다. 로그인해주세요.");
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  }


  const loadChatRooms = async () => {
    setIsLoadingChats(true);
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        console.error("토큰이 없습니다.");
        redirectToLogin();  // 토큰이 없으면 로그인 페이지로 이동
        return;
      }

      const response = await fetch(`http://localhost:8080/api/chat/rooms/my`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`, // 토큰을 Authorization 헤더에 포함
          "Content-Type": "application/json",
        },
        credentials: "include", // 세션 쿠키를 포함할 경우 필요
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setChatRooms(data.result);  // 채팅방 목록 업데이트
        }
      } else if (response.status === 401) {
        console.error("인증 오류: 로그인이 필요합니다.");
        redirectToLogin();  // 인증 실패시 로그인 페이지로 리디렉션
      } else {
        console.error("채팅방 목록 로드 실패:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("채팅방 목록 로드 실패:", error);
    } finally {
      setIsLoadingChats(false);
    }
  };

  const loadNotifications = async () => {
    setIsLoadingNotifications(true)
    try {
      const token = localStorage.getItem("accessToken")
      if (!token) return

      const [notificationsRes, countRes] = await Promise.all([
        fetch(`http://localhost:8080/api/notifications`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }),
        fetch(`http://localhost:8080/api/notifications/notice-count`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }),
      ])

      if (notificationsRes.ok) {
        const notificationsData = await notificationsRes.json()
        setNotifications(notificationsData.result?.content || [])
      }

      if (countRes.ok) {
        const countData = await countRes.json()
        setNotificationCount(countData.result || 0)
      }
    } catch (error) {
      console.error("알림 로드 실패:", error)
    } finally {
      setIsLoadingNotifications(false)
    }
  }

  const handleChatRoomClick = (room: ChatRoom) => {
    setActiveChatWindow(room)
    setOpenChatWindows((prev) => new Set(prev).add(room.roomId))
  }

  const closeChatWindow = (roomId?: number) => {
    if (roomId) {
      setOpenChatWindows((prev) => {
        const newSet = new Set(prev)
        newSet.delete(roomId)
        return newSet
      })
    }
    setActiveChatWindow(null)
  }



  const formatNotificationTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffHours < 24) {
      return `${diffHours}시간 전`
    } else if (diffDays < 7) {
      return `${diffDays}일 전`
    } else {
      return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
    }
  }

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get("/users/me", { withCredentials: true })
        setUserInfo(res.data.result)
      } catch (err: any) {
        console.error("유저 정보 오류:", err)
        redirectToLogin()
      }
    }

    if (!localStorage.getItem("accessToken")) {
      redirectToLogin()
      return
    }

    fetchUser()

    // 주기적으로 알림 확인
    const notificationInterval = setInterval(loadNotifications, 30000) // 30초마다

    return () => {
      clearInterval(notificationInterval)
    }
  }, [])

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
                if (e.key === "Enter") handleSearch()
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
            onOpen={loadNotifications}
            content={
              <div className={styles.notificationDropdown}>
                <div className={styles.notificationHeader}>
                  <h3>알림</h3>
                  {notificationCount > 0 && <span className={styles.notificationCount}>{notificationCount}개</span>}
                </div>
                {isLoadingNotifications ? (
                  <div className={styles.loadingMessage}>알림을 불러오는 중...</div>
                ) : notifications.length === 0 ? (
                  <div className={styles.emptyMessage}>알림이 없습니다</div>
                ) : (
                  <div className={styles.notificationList}>
                    {notifications.map((notification, index) => (
                      <div key={index} className={styles.notificationItem}>
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
                  </div>
                )}
              </div>
            }
          />

          <div className={styles.navSection}>
            <Dropdown
              icon="https://raw.githubusercontent.com/withong/my-storage/main/budderz/free-icon-conversation-5323491.png"
              alt="채팅"
              badge={chatRooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0)}  // 총 알림 수 표시
              onOpen={loadChatRooms}
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
                        <div key={room.roomId} className={styles.chatItem} onClick={() => handleChatRoomClick(room)}>
                          <div className={styles.chatItemContent}>
                            <div className={styles.chatItemHeader}>
                              <span className={styles.chatRoomName}>
                                {room.roomType === "GROUP"
                                  ? `🏠 ${room.roomName}`
                                  : `💬 ${room.otherUser?.userName || room.roomName}`}
                              </span>
                              {room.unreadCount > 0 && <span className={styles.unreadBadge}>{room.unreadCount}</span>}
                            </div>
                            {room.lastMessage && (
                              <div className={styles.lastMessage}>
                                <span className={styles.messageText}>{room.lastMessage}</span>
                                <span className={styles.messageTime}>{room.lastMessageTime}</span>
                              </div>
                            )}
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
      {activeChatWindow && userInfo && (
        <ChatWindow
          roomId={activeChatWindow.roomId}
          roomName={activeChatWindow.roomName}
          roomType={activeChatWindow.roomType}
          groupId={activeChatWindow.groupId}
          currentUserId={userInfo.id}
          onClose={() => closeChatWindow(activeChatWindow.roomId)}
        />
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
