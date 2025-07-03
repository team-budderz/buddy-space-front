"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useGroupPermissions } from "../layout"
import styles from "./chat.module.css"
import api from "@/app/api"

interface ChatRoom {
  roomId: number
  roomName: string
  roomType: "GROUP" | "DIRECT"
  description?: string
  participantCount: number
  lastMessage?: string
  lastMessageTime?: string
  unreadCount: number
  createdAt: string
}

interface CreateRoomData {
  name: string
  description: string
  chatRoomType: "GROUP" | "DIRECT"
  participantIds: number[]
}

export default function ChatPage() {
  const { id: groupId } = useParams()
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createRoomData, setCreateRoomData] = useState<CreateRoomData>({
    name: "",
    description: "",
    chatRoomType: "GROUP",
    participantIds: [],
  })

  const { isLoading: permissionsLoading, hasPermission, isMemberOrAbove } = useGroupPermissions()

  useEffect(() => {
    if (!permissionsLoading && isMemberOrAbove()) {
      loadChatRooms()
    }
  }, [permissionsLoading, isMemberOrAbove])

  const loadChatRooms = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem("accessToken")

      const response = await api.get(`/group/${groupId}/chat/rooms`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.data.result) {
        setChatRooms(response.data.result)
      }
    } catch (error) {
      console.error("채팅방 목록 로드 실패:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const createChatRoom = async () => {
    if (!createRoomData.name.trim()) {
      alert("채팅방 이름을 입력해주세요.")
      return
    }

    try {
      const token = localStorage.getItem("accessToken")

      await api.post(`/group/${groupId}/chat/rooms`, createRoomData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      setShowCreateModal(false)
      setCreateRoomData({
        name: "",
        description: "",
        chatRoomType: "GROUP",
        participantIds: [],
      })

      await loadChatRooms()
    } catch (error) {
      console.error("채팅방 생성 실패:", error)
      alert("채팅방 생성에 실패했습니다.")
    }
  }

  const openChatWindow = (room: ChatRoom) => {
    // 채팅창 열기 이벤트 발생
    window.dispatchEvent(
      new CustomEvent("openGroupChat", {
        detail: {
          roomId: room.roomId,
          roomName: room.roomName,
          roomType: room.roomType,
          groupId: Number(groupId),
        },
      }),
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading || permissionsLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>채팅방을 불러오는 중...</p>
      </div>
    )
  }

  if (!isMemberOrAbove()) {
    return (
      <div className={styles.errorContainer}>
        <p>채팅 기능을 사용할 권한이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <h2 className={styles.chatTitle}>
          <span className={styles.titleIcon}>💬</span>
          채팅방 목록
        </h2>
        {hasPermission("CREATE_DIRECT_CHAT_ROOM") && (
          <button className={styles.createButton} onClick={() => setShowCreateModal(true)}>
            <span className={styles.buttonIcon}>➕</span>
            채팅방 만들기
          </button>
        )}
      </div>

      <div className={styles.chatRoomsList}>
        {chatRooms.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>💬</span>
            <p>채팅방이 없습니다.</p>
            {hasPermission("CREATE_DIRECT_CHAT_ROOM") && (
              <button className={styles.createButton} onClick={() => setShowCreateModal(true)}>
                첫 번째 채팅방 만들기
              </button>
            )}
          </div>
        ) : (
          chatRooms.map((room) => (
            <div key={room.roomId} className={styles.chatRoomCard} onClick={() => openChatWindow(room)}>
              <div className={styles.roomHeader}>
                <div className={styles.roomInfo}>
                  <h3 className={styles.roomName}>
                    {room.roomType === "GROUP" ? "🏠" : "💬"} {room.roomName}
                  </h3>
                  <span className={styles.participantCount}>👥 {room.participantCount}명</span>
                </div>
                {room.unreadCount > 0 && <span className={styles.unreadBadge}>{room.unreadCount}</span>}
              </div>

              {room.description && <p className={styles.roomDescription}>{room.description}</p>}

              {room.lastMessage && (
                <div className={styles.lastMessage}>
                  <span className={styles.messageText}>{room.lastMessage}</span>
                  <span className={styles.messageTime}>{room.lastMessageTime && formatDate(room.lastMessageTime)}</span>
                </div>
              )}

              <div className={styles.roomFooter}>
                <span className={styles.createdDate}>생성일: {formatDate(room.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 채팅방 생성 모달 */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>새 채팅방 만들기</h3>
              <button className={styles.modalCloseButton} onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>채팅방 이름</label>
                <input
                  type="text"
                  value={createRoomData.name}
                  onChange={(e) =>
                    setCreateRoomData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="채팅방 이름을 입력하세요"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>설명 (선택사항)</label>
                <textarea
                  value={createRoomData.description}
                  onChange={(e) =>
                    setCreateRoomData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="채팅방에 대한 설명을 입력하세요"
                  className={styles.textarea}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>채팅방 유형</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      checked={createRoomData.chatRoomType === "GROUP"}
                      onChange={() =>
                        setCreateRoomData((prev) => ({
                          ...prev,
                          chatRoomType: "GROUP",
                        }))
                      }
                    />
                    그룹 채팅 (여러 명이 참여)
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelButton} onClick={() => setShowCreateModal(false)}>
                취소
              </button>
              <button className={styles.confirmButton} onClick={createChatRoom}>
                만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
