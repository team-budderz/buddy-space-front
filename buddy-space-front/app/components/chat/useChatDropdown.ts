"use client"

import { useEffect, useState } from "react"

export interface ChatRoom {
  roomId: number
  roomName: string
  roomType: "GROUP" | "DIRECT"
  groupId?: number
}

export function useChatDropdown() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null)
  const [openWindows, setOpenWindows] = useState<Set<number>>(new Set())
  const currentUserId = Number(localStorage.getItem("userId"))

  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    if (!token) return

    const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL!
    const fetchGroupChatRooms = async () => {
      try {
        const groupsRes = await fetch(`${baseURL}/groups/my`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const groupsData = await groupsRes.json()
        console.log("🧾 groupsData:", groupsData)

        const groupList = Array.isArray(groupsData.result?.content)
          ? groupsData.result.content
          : []

        const allRooms: ChatRoom[] = []

        for (const group of groupList) {
          const groupId = group.groupId || group.id
          if (!groupId) continue

          const chatRes = await fetch(`${baseURL}/group/${groupId}/chat/rooms/my`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const chatData = await chatRes.json()
          if (chatRes.ok && chatData.result) {
            allRooms.push(...chatData.result)
          }
        }

        setChatRooms(allRooms)
      } catch (err) {
        console.error("채팅방 불러오기 실패:", err)
      }
    }


    fetchGroupChatRooms()

    const listener = (e: any) => {
      const { roomId, roomName, roomType, groupId } = e.detail
      const isOpen = openWindows.has(roomId)
      if (!isOpen) {
        const room: ChatRoom = { roomId, roomName, roomType, groupId }
        setChatRooms((prev) => [...prev, room])
        setActiveRoom(room)
        setOpenWindows((prev) => new Set(prev).add(roomId))
      }
    }

    window.addEventListener("openDirectChat", listener)
    return () => window.removeEventListener("openDirectChat", listener)
  }, [])

  const closeRoom = (roomId: number) => {
    setOpenWindows((prev) => {
      const copy = new Set(prev)
      copy.delete(roomId)
      return copy
    })
    setActiveRoom(null)
  }

  return { chatRooms, activeRoom, setActiveRoom, closeRoom, currentUserId }
}
