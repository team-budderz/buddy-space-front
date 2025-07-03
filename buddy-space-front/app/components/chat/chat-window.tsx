"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import styles from "./chat-window.module.css"

interface Message {
  messageId: number
  senderId: number
  senderName: string
  senderProfileUrl?: string
  content: string
  messageType: "TEXT" | "FILE" | "IMAGE"
  sentAt: string
  attachmentUrl?: string
  isRead: boolean
}

interface ChatMember {
  userId: number
  userName: string
  profileImageUrl?: string
  role?: "LEADER" | "SUB_LEADER" | "MEMBER"
}

interface ChatWindowProps {
  roomId: number
  roomName: string
  roomType: "GROUP" | "DIRECT"
  groupId?: number
  onClose: () => void
  currentUserId: number
}

export default function ChatWindow({ roomId, roomName, roomType, groupId, onClose, currentUserId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [members, setMembers] = useState<ChatMember[]>([])
  const [showMembers, setShowMembers] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    loadMessages()
    loadMembers()
    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [roomId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const getAuthToken = () => localStorage.getItem("accessToken")

  const connectWebSocket = () => {
    const token = getAuthToken()
    if (!token) return

    const wsUrl = `ws://localhost:8080/ws/chat?token=${token}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log("WebSocket 연결됨")
      setIsConnected(true)

      // 채팅방 구독
      ws.send(
        JSON.stringify({
          type: "SUBSCRIBE",
          roomId: roomId,
        }),
      )
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.event === "message:receive") {
        setMessages((prev) => [...prev, data.data])
      } else if (data.event === "message:deleted") {
        setMessages((prev) => prev.filter((msg) => msg.messageId !== data.data.messageId))
      }
    }

    ws.onclose = () => {
      console.log("WebSocket 연결 종료")
      setIsConnected(false)
    }

    ws.onerror = (error) => {
      console.error("WebSocket 오류:", error)
      setIsConnected(false)
    }

    wsRef.current = ws
  }

  const loadMessages = async () => {
    try {
      const token = getAuthToken()
      const response = await fetch(`http://localhost:8080/api/group/${groupId}/chat/rooms/${roomId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(data.result || [])
      }
    } catch (error) {
      console.error("메시지 로드 실패:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMembers = async () => {
    if (roomType !== "GROUP") return

    try {
      const token = getAuthToken()
      const response = await fetch(`http://localhost:8080/api/group/${groupId}/chat/rooms/${roomId}/participants`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setMembers(data.result || [])
      }
    } catch (error) {
      console.error("멤버 로드 실패:", error)
    }
  }

  const sendMessage = () => {
    if (!newMessage.trim() || !wsRef.current || !isConnected) return

    const messageData = {
      event: "message:send",
      data: {
        roomId: roomId,
        senderId: currentUserId,
        messageType: "TEXT",
        content: newMessage.trim(),
        attachmentUrl: null,
      },
    }

    wsRef.current.send(JSON.stringify(messageData))
    setNewMessage("")
  }

  const deleteMessage = (messageId: number) => {
    if (!wsRef.current || !isConnected) return

    const deleteData = {
      event: "message:delete",
      data: {
        roomId: roomId,
        messageId: messageId,
        senderId: currentUserId,
      },
    }

    wsRef.current.send(JSON.stringify(deleteData))
  }

  const handleFileUpload = async (file: File) => {
    try {
      const token = getAuthToken()
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`http://localhost:8080/api/groups/${groupId}/post-files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        const fileData = data.result

        if (wsRef.current && isConnected) {
          const messageData = {
            event: "message:send",
            data: {
              roomId: roomId,
              senderId: currentUserId,
              messageType: fileData.type.startsWith("image/") ? "IMAGE" : "FILE",
              content: fileData.filename,
              attachmentUrl: fileData.url,
            },
          }

          wsRef.current.send(JSON.stringify(messageData))
        }
      }
    } catch (error) {
      console.error("파일 업로드 실패:", error)
    }
  }

  const kickMember = async (userId: number) => {
    if (!confirm("이 멤버를 채팅방에서 내보내시겠습니까?")) return

    try {
      const token = getAuthToken()
      await fetch(`http://localhost:8080/api/group/${groupId}/chat/rooms/${roomId}/participants/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      await loadMembers()
    } catch (error) {
      console.error("멤버 추방 실패:", error)
    }
  }

  const leaveRoom = async () => {
    if (!confirm("채팅방을 나가시겠습니까?")) return

    try {
      const token = getAuthToken()
      await fetch(`http://localhost:8080/api/group/${groupId}/chat/rooms/${roomId}/participants/${currentUserId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      onClose()
    } catch (error) {
      console.error("채팅방 나가기 실패:", error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }

  if (isLoading) {
    return (
      <div className={styles.chatWindow}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>채팅을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.chatWindow}>
      {/* 채팅 헤더 */}
      <div className={styles.chatHeader}>
        <div className={styles.headerLeft}>
          <h3 className={styles.roomName}>
            {roomType === "GROUP" ? "🏠" : "💬"} {roomName}
          </h3>
          <div className={styles.connectionStatus}>
            <span className={`${styles.statusDot} ${isConnected ? styles.connected : styles.disconnected}`}></span>
            {isConnected ? "연결됨" : "연결 끊김"}
          </div>
        </div>

        <div className={styles.headerRight}>
          {roomType === "GROUP" && (
            <button className={styles.membersButton} onClick={() => setShowMembers(!showMembers)}>
              👥 ({members.length})
            </button>
          )}
          <button className={styles.leaveButton} onClick={leaveRoom}>
            나가기
          </button>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className={styles.chatBody}>
        {/* 멤버 목록 사이드바 */}
        {showMembers && roomType === "GROUP" && (
          <div className={styles.membersSidebar}>
            <h4>멤버 ({members.length})</h4>
            <div className={styles.membersList}>
              {members.map((member) => (
                <div key={member.userId} className={styles.memberItem}>
                  <img
                    src={member.profileImageUrl || "/placeholder.svg?height=32&width=32"}
                    alt={member.userName}
                    className={styles.memberAvatar}
                  />
                  <span className={styles.memberName}>{member.userName}</span>
                  {member.userId !== currentUserId && (
                    <button className={styles.kickButton} onClick={() => kickMember(member.userId)}>
                      추방
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 메시지 영역 */}
        <div className={styles.messagesContainer}>
          <div className={styles.messagesList}>
            {messages.map((message) => (
              <div
                key={message.messageId}
                className={`${styles.messageItem} ${
                  message.senderId === currentUserId ? styles.myMessage : styles.otherMessage
                }`}
              >
                {message.senderId !== currentUserId && (
                  <img
                    src={message.senderProfileUrl || "/placeholder.svg?height=32&width=32"}
                    alt={message.senderName}
                    className={styles.senderAvatar}
                  />
                )}

                <div className={styles.messageContent}>
                  {message.senderId !== currentUserId && <div className={styles.senderName}>{message.senderName}</div>}

                  <div className={styles.messageBubble}>
                    {message.messageType === "IMAGE" && message.attachmentUrl ? (
                      <img
                        src={message.attachmentUrl || "/placeholder.svg"}
                        alt="이미지"
                        className={styles.messageImage}
                      />
                    ) : message.messageType === "FILE" && message.attachmentUrl ? (
                      <a
                        href={message.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.fileLink}
                      >
                        📎 {message.content}
                      </a>
                    ) : (
                      <span className={styles.messageText}>{message.content}</span>
                    )}

                    <div className={styles.messageInfo}>
                      <span className={styles.messageTime}>{formatTime(message.sentAt)}</span>
                      {message.senderId === currentUserId && (
                        <>
                          <span className={styles.readStatus}>{message.isRead ? "읽음" : "안읽음"}</span>
                          <button className={styles.deleteButton} onClick={() => deleteMessage(message.messageId)}>
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* 메시지 입력 영역 */}
      <div className={styles.messageInput}>
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileUpload(file)
          }}
          style={{ display: "none" }}
        />

        <button className={styles.fileButton} onClick={() => fileInputRef.current?.click()}>
          📎
        </button>

        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="메시지를 입력하세요..."
          className={styles.textInput}
          disabled={!isConnected}
        />

        <button className={styles.sendButton} onClick={sendMessage} disabled={!isConnected || !newMessage.trim()}>
          전송
        </button>
      </div>
    </div>
  )
}
