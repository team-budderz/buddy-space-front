"use client"

import { useCallback, useEffect, useRef, useState, useContext } from "react"
import { useChatPermissions } from "./useChatPermissions"
import type React from "react"
import { Client, type Frame } from "@stomp/stompjs"
import SockJS from "sockjs-client"
import styles from "./chat-window.module.css"

type WSDeleted = {
  event: "message:delete"
  data: {
    roomId: number
    messageId: number
    senderId?: number
    deletedAt?: string
  }
}

type WSCreated = {
  event: "message" | "message:created"
  data: Message
}

type WSIncoming = WSDeleted | WSCreated

interface Message {
  messageId: number
  senderId: number
  senderName?: string; // Make optional
  senderProfileUrl?: string; // Make optional
  content: string
  messageType: "TEXT" | "FILE" | "IMAGE"
  sentAt: string
  attachmentUrl?: string
}

interface ChatMember {
  userId: number
  name: string
  profileUrl?: string
  role?: "LEADER" | "SUB_LEADER" | "MEMBER"
}

interface GroupMembers {
  id: number
  name: string
  profileImageUrl?: string
  role?: "LEADER" | "SUB_LEADER" | "MEMBER"
}

interface ReadReceipt {
  userId: number
  lastReadMessageId: number
}

interface ChatWindowProps {
  roomId: number
  roomName: string
  roomType: "GROUP" | "DIRECT"
  groupId: number // Made required
  onClose: () => void
  currentUserId: number
}

export default function ChatWindow({ roomId, roomName, roomType, groupId, onClose, currentUserId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [members, setMembers] = useState<ChatMember[]>([])
  const [showMembers, setShowMembers] = useState(false)
  const [showInviteMembers, setShowInviteMembers] = useState(false) // New state
  const [showKickMembers, setShowKickMembers] = useState(false) // New state
  const [allGroupMembers, setAllGroupMembers] = useState<GroupMembers[]>([]) // New state
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([])
  const [isReadStatusLoaded, setIsReadStatusLoaded] = useState(false)

  const { isLoading: permsLoading, hasPermission, membership } = useChatPermissions(groupId)
  const isLeader = membership?.role === "LEADER"


  const messagesEndRef = useRef<HTMLDivElement>(null)
  const stompClientRef = useRef<Client | null>(null)

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!
  const CHAT_BASE = process.env.NEXT_PUBLIC_CHAT_BASE_URL!

  const getAuthToken = () => localStorage.getItem("accessToken")?.replace(/^"|"$/g, "")

  // 메시지를 시간순으로 정렬하는 함수
  const sortMessagesByTime = (messages: Message[]) => {
    return [...messages].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
  }

  // 스크롤 맨 아래로
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }
  useEffect(scrollToBottom, [messages])

  // 읽음 상태 디버깅 로그
  useEffect(() => {
    console.log("[DEBUG] 현재 읽음 상태:", readReceipts)
    console.log("[DEBUG] 현재 멤버:", members)
    console.log("[DEBUG] 현재 사용자 ID:", currentUserId)
    console.log("[DEBUG] 읽음 상태 로드됨:", isReadStatusLoaded)
  }, [readReceipts, members, currentUserId, isReadStatusLoaded])

  // WebSocket 연결 및 구독 설정
  const connectWebSocket = () => {
    const token = getAuthToken();
    if (!token) return;
    setIsLoading(true);

    // 1) CHAT_BASE에서 쿼리스트링 제거
    const cleanBase = CHAT_BASE.split('?')[0];  // or CHAT_BASE.replace(/\?.*$/, '')

    // 2) SockJS는 쿼리 없이 ws 엔드포인트만 지정
    const socket = new SockJS(`${cleanBase}/ws`);

    const client = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        Authorization: `Bearer ${token}`,  // STOMP CONNECT 헤더로만 토큰 전달
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (msg) => console.log("[WebSocket]", msg),
      onConnect: () => {
        console.log("[WebSocket] 연결 성공");
        setIsConnected(true);
        setIsLoading(false);

        // 메시지 수신 구독
        client.subscribe(`/sub/chat/rooms/${roomId}/messages`, ({ body }) => {
          try {
            const payload = JSON.parse(body)
            console.log("[WebSocket] 메시지 데이터:", payload)

            // 삭제 이벤트 처리
            if (payload.event === "message:delete" || payload.event === "message:deleted") {
              setMessages(prev => prev.filter(m => m.messageId !== payload.data.messageId));
              return;
            }

            // 새 메시지 처리 (직접 형식)
            if (payload.messageId && payload.senderId && payload.content) {
              const msg = payload as Message
              console.log("[WebSocket] 새 메시지 (직접):", msg)
              setMessages((prev) => {
                if (prev.some((x) => x.messageId === msg.messageId)) return prev
                return sortMessagesByTime([...prev, msg])
              })
              return
            }

            // 새 메시지 처리 (이벤트 래핑)
            if (payload.event === "message" || payload.event === "message:created") {
              const msg = payload.data as Message
              console.log("[WebSocket] 새 메시지 (이벤트):", msg)
              setMessages((prev) => {
                if (prev.some((x) => x.messageId === msg.messageId)) return prev
                return sortMessagesByTime([...prev, msg])
              })
            }
          } catch (error) {
            console.error("[WebSocket] 메시지 파싱 오류:", error)
          }
        })

        // 실시간 읽음 상태 구독 - 개별 읽음 업데이트
        client.subscribe(`/sub/chat/rooms/${roomId}/read`, ({ body }) => {
          try {
            const data = JSON.parse(body)
            console.log("[WebSocket] 실시간 읽음 상태 수신:", data)

            // 개별 읽음 업데이트 처리
            if (data.userId !== undefined && data.lastReadMessageId !== undefined) {
              console.log(
                `[WebSocket] 실시간 읽음 업데이트: 사용자 ${data.userId}가 메시지 ${data.lastReadMessageId}까지 읽음`,
              )
              setReadReceipts((prev) => {
                const filtered = prev.filter((r) => r.userId !== data.userId)
                const updated = [...filtered, { userId: data.userId, lastReadMessageId: data.lastReadMessageId }]
                console.log("[WebSocket] 읽음 상태 실시간 업데이트:", updated)
                return updated
              })
            }
          } catch (error) {
            console.error("[WebSocket] 실시간 읽음 상태 파싱 오류:", error)
          }
        })

        // 읽음 동기화 구독 - 초기 전체 읽음 상태
        client.subscribe(`/sub/chat/rooms/${roomId}/read-sync`, ({ body }) => {
          try {
            console.log("[WebSocket] 읽음 동기화 RAW 응답:", body)
            const data = JSON.parse(body)
            console.log("[WebSocket] 읽음 동기화 파싱된 응답:", data)

            // 배열 형태의 전체 읽음 상태 처리
            if (Array.isArray(data)) {
              console.log("[WebSocket] 초기 읽음 상태 전체 동기화 (배열):", data)
              setReadReceipts(data)
              setIsReadStatusLoaded(true)
            }
            // 혹시 다른 형태로 올 경우 대비
            else if (data.result && Array.isArray(data.result)) {
              console.log("[WebSocket] 초기 읽음 상태 동기화 (result):", data.result)
              setReadReceipts(data.result)
              setIsReadStatusLoaded(true)
            } else if (data.data && Array.isArray(data.data)) {
              console.log("[WebSocket] 초기 읽음 상태 동기화 (data):", data.data)
              setReadReceipts(data.data)
              setIsReadStatusLoaded(true)
            } else {
              console.log("[WebSocket] 예상하지 못한 읽음 동기화 응답 형태:", data)
              // 예상하지 못한 형태라도 로딩 완료로 처리하고 빈 배열로 초기화
              setReadReceipts([])
              setIsReadStatusLoaded(true)
            }
          } catch (error) {
            console.error("[WebSocket] 읽음 동기화 파싱 오류:", error, "원본 데이터:", body)
            // 파싱 오류가 발생해도 로딩 완료로 처리하고 빈 배열로 초기화
            setReadReceipts([])
            setIsReadStatusLoaded(true)
          }
        })

        // 초기 데이터 로드 후 읽음 동기화 요청
        initializeData(client)
      },
      onStompError: (frame: Frame) => {
        console.error("[WebSocket] STOMP 오류:", frame.headers.message)
        setIsConnected(false)
        setIsLoading(false)
      },
      onDisconnect: () => {
        console.log("[WebSocket] 연결 해제")
        setIsConnected(false)
      },
    })

    client.activate()
    stompClientRef.current = client
  }

  // 초기 데이터 로드 및 읽음 동기화
  const initializeData = async (client: Client) => {
    try {
      console.log("[initializeData] 초기화 시작")

      // 1. 멤버와 메시지를 순차적으로 로드 (멤버 먼저)
      console.log("[initializeData] 채팅 멤버 로딩 시작...")
      await loadChatMembers()
      console.log("[initializeData] 채팅 기록 로딩 시작...")
      await loadChatHistory()
      console.log("[initializeData] 데이터 로딩 완료.")

      // 모든 데이터 로드 후 로딩 상태 해제
      setIsLoading(false)

      // 2. 읽음 동기화 요청 - 백엔드 컨트롤러에 맞게 수정
      const latestMessageId = messages.length > 0 ? messages[messages.length - 1].messageId : 0
      console.log("[WebSocket] 읽음 동기화 요청 전송 - lastReadMessageId:", latestMessageId)
      client.publish({
        destination: `/pub/chat/rooms/${roomId}/read-sync`,
        body: JSON.stringify({ lastReadMessageId: latestMessageId }), // 백엔드 ReadReceiptRequest에 맞춤
      })

      // 3. 타임아웃 설정 - 3초 후 강제로 로딩 완료 처리
      setTimeout(() => {
        if (!isReadStatusLoaded) {
          console.log("[WebSocket] 읽음 상태 로딩 타임아웃 - 강제 완료 처리")
          console.log("[WebSocket] 현재 readReceipts:", readReceipts)
          setIsReadStatusLoaded(true)
        }
      }, 3000)

      console.log("[initializeData] 초기화 완료")
    } catch (error) {
      console.error("[initializeData] 초기화 오류:", error)
      setIsLoading(false) // 에러 발생 시에도 로딩 상태 해제
    }
  }

  // 모든 그룹 멤버 불러오기 (초대/강퇴용)
  const loadAllGroupMembers = async () => {
    if (!groupId) return
    const token = getAuthToken()
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/groups/${groupId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const d = await res.json()
        const allMbrs: GroupMembers[] = (Array.isArray(d.result?.members) ? d.result.members : []) || (Array.isArray(d.data?.members) ? d.data.members : [])
        setAllGroupMembers(allMbrs)
        console.log("[loadAllGroupMembers] 모든 그룹 멤버 로드 완료:", allMbrs)
      }
    } catch (error) {
      console.error("[loadAllGroupMembers] 오류:", error)
    }
  }

  useEffect(() => {
    connectWebSocket()
    loadAllGroupMembers()
    return () => {
      stompClientRef.current?.deactivate()
    }
  }, [roomId, groupId])

  // 이전 채팅 불러오기
  const loadChatHistory = async () => {
    if (!groupId) return
    const token = getAuthToken()
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/group/${groupId}/chat/rooms/${roomId}/messages?page=0&size=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const d = await res.json()
        const msgs: Message[] =
          (d.result?.messages as Message[]) ||
          (d.data?.messages as Message[]) ||
          (Array.isArray(d.result) ? d.result : []) ||
          (Array.isArray(d.data) ? d.data : [])

        const sortedMessages = sortMessagesByTime(msgs)
        setMessages(sortedMessages)
        console.log("[loadChatHistory] 메시지 로드 완료:", sortedMessages.length)
      }
    } catch (error) {
      console.error("[loadChatHistory] 오류:", error)
    }
  }

  // 채팅 멤버 불러오기
  const loadChatMembers = async () => {
    if (!groupId) return
    const token = getAuthToken()
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/group/${groupId}/chat/rooms/${roomId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const d = await res.json()
        const mbrs: ChatMember[] = (Array.isArray(d.result) ? d.result : []) || (Array.isArray(d.data) ? d.data : [])
        setMembers(mbrs)
        console.log("[loadChatMembers] 멤버 로드 완료:", mbrs.length)
      }
    } catch (error) {
      console.error("[loadChatMembers] 오류:", error)
    }
  }

  const inviteMember = useCallback(async (userId: number) => {
    if (!groupId) return
    const token = getAuthToken()
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/group/${groupId}/chat/rooms/${roomId}/participants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        console.log(`[inviteMember] 사용자 ${userId} 초대 성공`)
        loadChatMembers() // Refresh member list
        loadAllGroupMembers() // Refresh all group members
        setShowInviteMembers(false) // Close invite list
      } else {
        const err = await res.json()
        console.error("[inviteMember] 초대 실패:", err)
        alert(`초대 실패: ${err.message || res.statusText}`)
      }
    } catch (error) {
      console.error("[inviteMember] 오류:", error)
      alert("초대 중 오류가 발생했습니다.")
    }
  }, [groupId, roomId, getAuthToken, loadChatMembers, loadAllGroupMembers])

  const kickMember = useCallback(async (userId: number) => {
    if (!groupId) return
    const token = getAuthToken()
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/group/${groupId}/chat/rooms/${roomId}/participants/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        console.log(`[kickMember] 사용자 ${userId} 강퇴 성공`)
        loadChatMembers() // Refresh member list
        setShowKickMembers(false) // Close kick list
      } else {
        const err = await res.json()
        console.error("[kickMember] 강퇴 실패:", err)
        alert(`강퇴 실패: ${err.message || res.statusText}`)
      }
    } catch (error) {
      console.error("[kickMember] 오류:", error)
      alert("강퇴 중 오류가 발생했습니다.")
    }
  }, [groupId, roomId, getAuthToken, loadChatMembers])

  const leaveChat = useCallback(async () => {
    if (!groupId) return
    const token = getAuthToken()
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/group/${groupId}/chat/rooms/${roomId}/participants/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      onClose()
      if (res.ok) {
        console.log(`[leaveChat] 채팅방 ${roomName} 나가기 성공`)
      } else {
        const err = await res.json()
        console.error("[leaveChat] 채팅방 나가기 실패:", err)
        alert(`채팅방 나가기 실패: ${err.message || res.statusText}`)
      }
    } catch (error) {
      console.error("[leaveChat] 오류:", error)
      alert("채팅방 나가기 중 오류가 발생했습니다.")
    }
  }, [groupId, roomId, onClose])

  const sendMessage = useCallback(() => {
    const client = stompClientRef.current
    if (!newMessage.trim() || !client || !isConnected) return

    const content = newMessage.trim()
    console.log("[sendMessage] 메시지 전송:", content)

    try {
      const messagePayload = {
        roomId: roomId,
        senderId: currentUserId,
        messageType: "TEXT",
        content: content,
        attachmentUrl: null,
      }

      client.publish({
        destination: `/pub/chat/message`,
        body: JSON.stringify(messagePayload),
      })

      setNewMessage("")
      console.log("[sendMessage] 메시지 전송 완료")
      setTimeout(scrollToBottom, 100)
    } catch (error) {
      console.error("[sendMessage] 전송 오류:", error)
    }
  }, [newMessage, isConnected, roomId, currentUserId])

  const deleteMessage = useCallback(
    (messageId: number, event?: React.MouseEvent) => {
      event?.stopPropagation()

      const client = stompClientRef.current
      if (!client || !isConnected) return

      console.log("[deleteMessage] 메시지 삭제 요청:", messageId)

      try {
        client.publish({
          destination: `/pub/chat/rooms/${roomId}/messages/${messageId}`,
          body: JSON.stringify({
            event: "message:delete",
            data: {
              roomId,
              messageId,
              senderId: currentUserId,
            }
          }),
        })

        console.log("[deleteMessage] 삭제 요청 전송 완료")
      } catch (error) {
        console.error("[deleteMessage] 삭제 오류:", error)
      }
    },
    [roomId, isConnected, currentUserId],
  )


  // 읽음 처리
  const markAsRead = useCallback(
    (messageId: number) => {
      const client = stompClientRef.current
      if (!client || !isConnected) return

      console.log("[markAsRead] 읽음 처리:", messageId)

      try {
        client.publish({
          destination: `/pub/chat/rooms/${roomId}/read`,
          body: JSON.stringify({ lastReadMessageId: messageId }),
        })
      } catch (error) {
        console.error("[markAsRead] 읽음 처리 오류:", error)
      }
    },
    [isConnected, roomId],
  )

  // 새 메시지가 올 때마다 자동 읽음 처리
  useEffect(() => {
    if (messages.length > 0 && isConnected && isReadStatusLoaded) {
      const latestMessage = messages[messages.length - 1]
      // 채팅방에 있을 때 자동으로 최신 메시지까지 읽음 처리
      setTimeout(() => {
        markAsRead(latestMessage.messageId)
      }, 500)
    }
  }, [messages, isConnected, isReadStatusLoaded, markAsRead])

  // 메시지 시간 포맷터
  function formatTime(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }

  // 읽음 상태 표시 로직
  const getReadStatus = (messageId: number) => {
    console.log(`[DEBUG] getReadStatus 호출 - messageId: ${messageId}`)
    console.log(`[DEBUG] isReadStatusLoaded: ${isReadStatusLoaded}`)
    console.log(`[DEBUG] readReceipts:`, readReceipts)
    console.log(`[DEBUG] members:`, members)
    console.log(`-------------------------------------------------------------------`)
    console.log(`[DEBUG] roomType:`, roomType)
    console.log(`[DEBUG] invitePermission:`, hasPermission("INVITE_CHAT_PARTICIPANT"))
    console.log(`[DEBUG] kickPermission:`, hasPermission("KICK_CHAT_PARTICIPANT"))
    console.log(`-------------------------------------------------------------------`)

    // 읽음 상태가 아직 로드되지 않았으면 로딩 표시
    if (!isReadStatusLoaded) {
      console.log(`[DEBUG] 읽음 상태 아직 로드되지 않음`)
      return "..."
    }

    // 본인을 제외한 멤버 수
    const otherMembersCount = members.length - 1
    console.log(`[DEBUG] 다른 멤버 수: ${otherMembersCount}`)

    if (otherMembersCount <= 0) {
      console.log(`[DEBUG] 혼자 있는 방 - 읽음 처리`)
      return "읽음" // 혼자 있는 방
    }

    // 해당 메시지를 읽은 사람 수 (본인 제외)
    const readCount = readReceipts.filter((r) => {
      const hasRead = r.lastReadMessageId >= messageId && r.userId !== currentUserId
      console.log(
        `[DEBUG] 사용자 ${r.userId}: lastRead=${r.lastReadMessageId}, messageId=${messageId}, hasRead=${hasRead}`,
      )
      return hasRead
    }).length

    console.log(`[DEBUG] 메시지 ${messageId} - 전체: ${otherMembersCount}, 읽음: ${readCount}`)

    // 읽은 사람이 전체 인원과 같으면 "읽음"
    if (readCount >= otherMembersCount) {
      console.log(`[DEBUG] 모든 사람이 읽음`)
      return "읽음"
    } else {
      const unreadCount = otherMembersCount - readCount
      console.log(`[DEBUG] ${unreadCount}명 안읽음`)
      return `${unreadCount}명 안읽음`
    }
  }

  if (isLoading) {
    // return <div className={styles.loading}>로딩 중...</div>
    console.log("isLoading", isLoading)
  }

  return (
    <div className={styles.chatWindow}>
      <div className={styles.chatHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.roomTitleContainer}>
            <h3 className={styles.roomName}>
              {roomType === "GROUP" ? "🏠" : "💬"} {roomName}
            </h3>
            <span
              className={styles.memberCount}
              onClick={() => setShowMembers((s) => !s)}
            >
              ({members.length})
            </span>
          </div>
          <div className={styles.connectionStatus}>
            <span className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`}></span>
            {isConnected ? "연결됨" : "끊김"}
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className={styles.chatBody}>
        <div className={`${styles.membersSidebar} ${showMembers ? styles.open : ""}`}>
          <div className={styles.membersHeader}>
            <h4>참여자 목록</h4>
            <button className={styles.closeMembersButton} onClick={() => setShowMembers(false)}>
              ✕
            </button>
          </div>
          <div className={styles.membersList}>
            {members.map(m => (
              <div className={styles.memberItem} key={m.userId}>
                <img src={m.profileUrl || "/placeholder.svg"} className={styles.memberAvatar} />
                <div className={styles.memberName}>{m.name}</div>
              </div>
            ))}
          </div>

          <div className={styles.actionButtons}>
            {roomType === "GROUP" && (
              <>
                {!permsLoading && hasPermission("INVITE_CHAT_PARTICIPANT") && (
                  <button className={styles.actionButton} onClick={() => setShowInviteMembers(true)}>초대하기</button>
                )}
                {!permsLoading && hasPermission("KICK_CHAT_PARTICIPANT") && (
                  <button className={styles.actionButton} onClick={() => setShowKickMembers(true)}>강퇴하기</button>
                )}
              </>
            )}
            {/* 그룹 리더가 아닐 때 또는 다이렉트일 때만 나가기 */}
            {(roomType === "DIRECT" || (roomType === "GROUP" && !isLeader)) && (
              <button className={styles.actionButton} onClick={leaveChat}>나가기</button>
            )}
          </div>

          {showInviteMembers && (
            <div className={styles.overlayList}>
              <h4>초대할 멤버 선택</h4>
              {(() => {
                const candidates = allGroupMembers.filter((member) =>
                  member.id !== currentUserId &&
                  !members.some((chatMember) => chatMember.userId === member.id)
                )
                return candidates.length > 0 ? (
                  <div className={styles.membersList}>
                    {candidates.map((member) => (
                      <div className={styles.memberItem} key={member.id}>
                        <img src={member.profileImageUrl || "/placeholder.svg"} className={styles.memberAvatar} />
                        <div className={styles.memberName}>{member.name}</div>
                        <button className={styles.inviteKickButton} onClick={() => inviteMember(member.id)}>
                          초대
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyMessage}>모든 멤버가 참여 중입니다.</div>
                )
              })()}
              <button className={styles.closeOverlayButton} onClick={() => setShowInviteMembers(false)}>
                닫기
              </button>
            </div>
          )}

          {showKickMembers && (
            <div className={styles.overlayList}>
              <h4>강퇴할 멤버 선택</h4>
              {(() => {
                const kickCandidates = members.filter((member) => member.userId !== currentUserId)
                return kickCandidates.length > 0 ? (
                  <div className={styles.membersList}>
                    {kickCandidates.map((member) => (
                      <div className={styles.memberItem} key={member.userId}>
                        <img src={member.profileUrl || "/placeholder.svg"} className={styles.memberAvatar} />
                        <div className={styles.memberName}>{member.name}</div>
                        <button
                          className={styles.inviteKickButton}
                          onClick={() => kickMember(member.userId)}
                        >
                          강퇴
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyMessage}>채팅에 참여 중인 멤버가 없습니다.</div>
                )
              })()}
              <button className={styles.closeOverlayButton} onClick={() => setShowKickMembers(false)}>
                닫기
              </button>
            </div>
          )}
        </div>

        <div className={styles.messagesContainer}>
          <div className={styles.messagesList}>
            {messages.length === 0 ? (
              <div className={styles.emptyMessages}>
                <p>아직 메시지가 없습니다.</p>
                <p>첫 번째 메시지를 보내보세요! 👋</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === currentUserId
                const sender = members.find((m) => m.userId === msg.senderId)
                const senderName = sender?.name
                const senderProfileUrl = sender?.profileUrl || "/placeholder.svg"

                console.log("sender: " + sender + ", senderName: " + senderName + ", profile: " + senderProfileUrl);

                return (
                  <div
                    key={msg.messageId}
                    className={`${styles.messageItem} ${isMe ? styles.myMessage : styles.otherMessage}`}
                    onClick={() => {
                      markAsRead(msg.messageId)
                    }}
                  >
                    {!isMe && <img src={senderProfileUrl} alt={senderName || "avatar"} className={styles.senderAvatar} />}
                    <div className={styles.messageContent}>
                      {!isMe && senderName && <div className={styles.senderName}>{senderName}</div>}
                      <div className={styles.messageBubble}>
                        <span className={styles.messageText}>{msg.content}</span>
                      </div>
                      <div className={styles.messageInfo}>
                        <span className={styles.messageTime}>{formatTime(msg.sentAt)}</span>
                        {isMe && (
                          <>
                            <span className={styles.readCount}>{getReadStatus(msg.messageId)}</span>
                            <button
                              className={styles.deleteButton}
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteMessage(msg.messageId, e)
                              }}
                              title="메시지 삭제"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.messageInput}>
            <input
              type="text"
              className={styles.textInput}
              placeholder="메시지를 입력하세요..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              disabled={!isConnected}
            />
            <button className={styles.sendButton} onClick={sendMessage} disabled={!newMessage.trim() || !isConnected}>
              📤
            </button>
          </div>
        </div>
      </div>
    </div >
  )
}

