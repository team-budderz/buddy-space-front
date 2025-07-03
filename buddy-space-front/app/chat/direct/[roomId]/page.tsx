"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Client } from "@stomp/stompjs"
import SockJS from "sockjs-client"
import styles from "./chat.module.css"

const SOCKET_URL = "http://localhost:8080/ws"

interface ChatMessage {
    messageId: number
    roomId: number
    senderId: number
    senderName: string
    messageType: "TEXT" | "FILE"
    content: string
    sentAt: string
}

export default function DirectChatPage() {
    const { roomId } = useParams()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [newMessage, setNewMessage] = useState("")
    const stompClient = useRef<Client | null>(null)
    const currentUserId = Number(localStorage.getItem("userId"))

    useEffect(() => {
        const socket = new SockJS(SOCKET_URL)
        const client = new Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000,
            onConnect: () => {
                client.subscribe(`/sub/chat/rooms/${roomId}/messages`, (message) => {
                    const payload = JSON.parse(message.body)
                    if (payload.event === "message:receive") {
                        setMessages((prev) => [...prev, payload.data])
                    }
                })
            },
        })

        stompClient.current = client
        client.activate()
        return () => {
            client.deactivate()
        }
    }, [roomId])

    const sendMessage = () => {
        if (!newMessage.trim()) return
        const token = localStorage.getItem("accessToken")
        stompClient.current?.publish({
            destination: `/pub/chat/rooms/${roomId}/messages`,
            body: JSON.stringify({
                event: "message:send",
                data: {
                    roomId,
                    senderId: currentUserId,
                    messageType: "TEXT",
                    content: newMessage,
                    attachmentUrl: null,
                },
            }),
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        setNewMessage("")
    }

    const deleteMessage = (messageId: number) => {
        stompClient.current?.publish({
            destination: `/pub/chat/rooms/${roomId}/messages/${messageId}`,
            body: JSON.stringify({
                event: "message:delete",
                data: {
                    roomId,
                    messageId,
                    senderId: currentUserId,
                },
            }),
        })
    }

    return (
        <div className={styles.chatContainer}>
            <header className={styles.chatHeader}>
                <span>💬 1:1 대화방</span>
                <span className={styles.noAlert}>알림 없습니다</span>
            </header>

            <div className={styles.messageList}>
                {messages.map((msg) => {
                    const isMe = msg.senderId === currentUserId
                    return (
                        <div key={msg.messageId} className={isMe ? styles.myMessage : styles.otherMessage}>
                            {!isMe && <p className={styles.senderName}>{msg.senderName}</p>}
                            <div className={styles.messageBubble}>
                                <span>{msg.content}</span>
                                {isMe && (
                                    <div className={styles.messageActions}>
                                        {/* 수정 기능은 UI만 있고 아직 구현은 안함 */}
                                        <button onClick={() => deleteMessage(msg.messageId)}>삭제</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className={styles.inputArea}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="메시지를 입력하세요"
                />
                <button onClick={sendMessage}>전송</button>
            </div>
        </div>
    )
}
