
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useGroupPermissions } from "@/app/components/hooks/usegrouppermissiont"
import styles from "./members.module.css"
import axios from "axios"
import api from "@/app/api"
import { createPortal } from "react-dom"

// ModalPortal 컴포넌트 추가
function ModalPortal({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted || !isOpen) return null

  return createPortal(children, document.body)
}

interface Member {
  id: number
  name: string
  role: "LEADER" | "SUB_LEADER" | "MEMBER"
  profileImageUrl?: string
  joinedAt: string
}

interface InviteData {
  groupName: string
  groupDescription?: string
  inviteLink?: string
  code?: string
}

interface ToastState {
  show: boolean
  message: string
  type: "success" | "error" | "warning" | "info"
}

async function getAuthHeaders(): Promise<{ Authorization: string; "Content-Type": string }> {
  const token = localStorage.getItem("accessToken")
  if (!token) throw new Error("토큰이 없습니다. 로그인해주세요.")
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

export default function MembersPage() {
  const router = useRouter()
  const { id: groupId } = useParams()
  const [currentUser, setCurrentUser] = useState<Member | null>(null)
  const [groupMembers, setGroupMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" })

  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [profileModalData, setProfileModalData] = useState({ imageUrl: "", joinDate: "" })
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [isCreatingInvite, setIsCreatingInvite] = useState(false)

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

  const { isLoading: permissionsLoading, isLeader, hasPermission } = useGroupPermissions()

  const fetchChatRooms = async () => {
    const headers = await getAuthHeaders()
    const res = await api.get(`/group/${groupId}/chat/rooms/my`, { headers })
    return res.data.result as any[]
  }

  const findGroupRoomId = (rooms: any[]) => {
    const groupRoom = rooms.find(r => r.roomType === "GROUP")
    return groupRoom?.roomId as number | undefined
  }

  const leaveChatRoom = async (roomId: number) => {
    const headers = await getAuthHeaders()
    await api.delete(`/group/${groupId}/chat/rooms/${roomId}/participants/me`, { headers })
  }

  const removeChatParticipant = async (roomId: number, userId: number) => {
    const headers = await getAuthHeaders()
    await api.delete(`/group/${groupId}/chat/rooms/${roomId}/participants/${userId}`, { headers })
  }

  const getValidToken = async (): Promise<string | null> => {
    const token = getAuthToken()
    if (!token) return null

    if (!isTokenValid(token)) {
      try {
        const email = localStorage.getItem("userEmail")
        const password = localStorage.getItem("userPassword")

        if (!email || !password) return null

        const res = await api.post("/token/refresh", { email, password })
        const newToken = res.data.result?.accessToken

        if (newToken) {
          localStorage.setItem("accessToken", newToken)
          return newToken
        } else {
          return null
        }
      } catch (err) {
        console.error("토큰 재발급 실패:", err)
        return null
      }
    }

    return token
  }

  const getAuthToken = () => {
    if (typeof window === "undefined") return null
    return localStorage.getItem("accessToken") || localStorage.getItem("token")
  }

  const isTokenValid = (token: string) => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      const currentTime = Math.floor(Date.now() / 1000)
      return payload.exp > currentTime
    } catch (error) {
      console.error("토큰 디코딩 실패:", error)
      return false
    }
  }

  const getAuthHeaders = async () => {
    const token = await getValidToken()
    if (!token) {
      throw new Error("유효하지 않은 토큰")
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  }

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      showToast("로그인이 필요합니다.", "error")
      router.push("/login")
      return
    }

    if (!isTokenValid(token)) {
      showToast("토큰이 만료되었습니다. 다시 로그인해주세요.", "error")
      localStorage.clear()
      router.push("/login")
      return
    }

    if (!permissionsLoading) {
      loadMembersData()
    }
  }, [permissionsLoading, router])

  const loadMembersData = async () => {
    try {
      setIsLoading(true)
      const token = getAuthToken()

      const userResponse = await api({
        method: "GET",
        url: "/users/me",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      const userData = userResponse.data.result

      const membersResponse = await api({
        method: "GET",
        url: `/groups/${groupId}/members`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      const membersData = membersResponse.data.result

      if (membersData?.members) {
        setGroupMembers(membersData.members)
        const currentUserMembership = membersData.members.find((member: Member) => member.id === userData.id)
        if (currentUserMembership) {
          setCurrentUser(currentUserMembership)
        }
      }
    } catch (error: any) {
      console.error("멤버 데이터 로드 실패:", error)

      if (error.message.includes("토큰") || error.response?.status === 401) {
        showToast("인증이 만료되었습니다. 다시 로그인해주세요.", "error")
        localStorage.clear()
        router.push("/login")
      } else {
        showToast("멤버 정보를 불러오는데 실패했습니다.", "error")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (message: string, type: ToastState["type"] = "success") => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3000)
  }

  const getRoleText = (role: string) => {
    const roleMap = { LEADER: "리더", SUB_LEADER: "부리더", MEMBER: "멤버" }
    return roleMap[role as keyof typeof roleMap] || "멤버"
  }

  const formatJoinDate = (joinedAt: string) => {
    if (!joinedAt) return "가입일 정보 없음"
    const date = new Date(joinedAt)
    return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, "0")}월 ${String(date.getDate()).padStart(2, "0")}일 가입`
  }

  const handleProfileClick = (imageUrl: string, joinedAt: string) => {
    setProfileModalData({
      imageUrl: imageUrl || "/placeholder.svg?height=200&width=200",
      joinDate: formatJoinDate(joinedAt),
    })
    setShowProfileModal(true)
  }

  const handleMemberMenuClick = (member: Member) => {
    setSelectedMember(member)
    setShowMenuModal(true)
  }

  const kickMember = async (memberId: number, memberName: string) => {
    if (!confirm(`${memberName}님을 모임에서 강제 탈퇴시키시겠습니까?`)) return

    try {
      const headers = await getAuthHeaders()
      // 모임 강제 탈퇴
      await api.delete(`/groups/${groupId}/members/${memberId}/expel`, { headers })
      showToast(`${memberName}님이 모임에서 탈퇴되었습니다.`)
      closeModal()

      // 채팅방에서도 강퇴 처리
      const rooms = await fetchChatRooms()
      const groupRoomId = findGroupRoomId(rooms)
      if (groupRoomId) {
        await removeChatParticipant(groupRoomId, memberId)
      }

      await loadMembersData()
    } catch (error: any) {
      console.error("강제 탈퇴 실패:", error)
      showToast(`강제 탈퇴 실패: ${error.response?.data?.message || "알 수 없는 오류"}`, "error")
    }
  }

  const blockMember = async (memberId: number, memberName: string) => {
    if (!confirm(`${memberName}님을 차단하시겠습니까?`)) return

    try {
      const headers = await getAuthHeaders()
      // 모임 차단
      await api.patch(`/groups/${groupId}/members/${memberId}/block`, {}, { headers })
      showToast(`${memberName}님이 차단되었습니다.`)
      closeModal()

      // 채팅방에서도 강퇴 처리
      const rooms = await fetchChatRooms()
      const groupRoomId = findGroupRoomId(rooms)
      if (groupRoomId) {
        await removeChatParticipant(groupRoomId, memberId)
      }

      await loadMembersData()
    } catch (error: any) {
      console.error("차단 실패:", error)
      showToast(`차단 실패: ${error.response?.data?.message || "알 수 없는 오류"}`, "error")
    }
  }


 const startDirectChat = async (memberId: number, memberName: string) => {
  try {
    // 0) 토큰, 유저 정보 검증
    const token = await getValidToken();
    if (!token) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!currentUser) {
      alert("사용자 정보가 없습니다.");
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    let roomId: number;

    try {
      const res = await api.post(
        `/group/${groupId}/chat/rooms`,
        {
          name: `${currentUser.name}와 ${memberName}의 채팅`,
          description: "1:1 대화방",
          chatRoomType: "DIRECT",
          participantIds: [currentUser.id, memberId],
        },
        { headers, withCredentials: true }
      );
      roomId = res.data.result.roomId;
    } catch (err: any) {
      if (err.response?.status === 409) {
        const listRes = await api.get(
          `/group/${groupId}/chat/rooms/my`,
          { headers, withCredentials: true }
        );
        console.log("🔍 [DEBUG 1] 내 채팅방 목록 전체:", listRes.data.result);

        const chatRooms = listRes.data.result as any[];

        chatRooms.forEach((room, idx) => {
          console.log(`— [DEBUG 2] 방[${idx}]`, {
            roomId: room.roomId,
            type: room.chatRoomType,
            participants: room.participants.map((p: any) => ({
              raw: p,
              keys: Object.keys(p),
              idValue: p.userId ?? p.id ?? p.memberId,
            })),
          });
        });

        const targetIds = [currentUser.id, memberId].sort((a, b) => a - b);
        console.log("🔍 [DEBUG 3] 비교 대상 targetIds:", targetIds);

        const direct = chatRooms.find(r => {
          if (r.chatRoomType !== "DIRECT") return false;
          const ids = r.participants
            .map((p: any) => p.userId ?? p.id ?? p.memberId)
            .sort((a: number, b: number) => a - b);
          console.log(`   [DEBUG 3] 방 ${r.roomId} IDs:`, ids);
          return JSON.stringify(ids) === JSON.stringify(targetIds);
        });

        console.log("🔍 [DEBUG 3] find 결과 direct:", direct);

        if (!direct) {
          throw new Error("기존 1:1 방을 찾을 수 없습니다.");
        }
        roomId = direct.roomId;
      } else {
        throw err;
      }
    }

    window.dispatchEvent(
      new CustomEvent("openDirectChat", {
        detail: {
          roomId,
          roomName: `${memberName}과의 채팅`,
          roomType: "DIRECT",
          groupId: Number(groupId),
        },
      })
    );
    closeModal();
  } catch (err: any) {
    console.error("1:1 채팅방 열기 실패", err);
    alert("1:1 채팅방 열기 실패");
  }
};





  const handleAuthError = () => {
    showToast("인증이 만료되었습니다. 다시 로그인해주세요.", "error")
    localStorage.clear()
    router.push("/login")
  }

  const inviteMembers = async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await api.get(`/groups/${groupId}/invites`, { headers })
      setInviteData(res.data.result)
      setShowInviteModal(true)
    } catch (e: any) {
      if (e.response?.status === 404) {
        setInviteData({ groupName: "모임", groupDescription: "새 친구를 초대해보세요!" })
        setShowInviteModal(true)
      } else if (e.response?.status === 401) handleAuthError()
      else showToast("초대 링크 조회 실패", "error")
    }
  }

  const createInviteLink = async () => {
    try {
      setIsCreatingInvite(true)
      const headers = await getAuthHeaders()
      const res = await axios.patch(`${API_BASE}/groups/${groupId}/invites`, {}, { headers })
      setInviteData(res.data.result)
      showToast("초대 링크 생성 완료")
    } catch (e: any) {
      if (e.response?.status === 401) handleAuthError()
      else showToast("초대 링크 생성 실패", "error")
    } finally {
      setIsCreatingInvite(false)
    }
  }

  const refreshInviteLink = async () => {
    if (!confirm("새로운 초대 링크를 생성하시겠습니까? 기존 링크는 사용할 수 없게 됩니다.")) return

    try {
      setIsCreatingInvite(true)

      try {
        const headers = await getAuthHeaders()
        await api.delete(`${API_BASE}/groups/${groupId}/invites`, { headers })
      } catch (deleteError) {
        console.warn("기존 링크 삭제 실패:", deleteError)
      }

      await createInviteLink()
    } catch (error: any) {
      console.error("초대 링크 새로고침 실패:", error)
      showToast(`초대 링크 새로고침 실패: ${error.response?.data?.message || "알 수 없는 오류"}`, "error")
    } finally {
      setIsCreatingInvite(false)
    }
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${type}가 복사되었습니다!`)
    } catch (error) {
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      document.body.appendChild(textArea)
      textArea.select()

      try {
        document.execCommand("copy")
        showToast(`${type}가 복사되었습니다!`)
      } catch {
        showToast("복사에 실패했습니다.", "error")
      }

      document.body.removeChild(textArea)
    }
  }

  const withdrawFromGroup = async () => {
    if (
      !confirm(
        "정말로 이 모임에서 탈퇴하시겠습니까?\n탈퇴 후에는 다시 가입 요청을 하거나, \n비공개 모임일 경우 초대 링크로만 참여할 수 있습니다."
      )
    )
      return

    try {
      const headers = await getAuthHeaders()

      // 1. 채팅방 나가기 먼저 처리
      try {
        const rooms = await fetchChatRooms()
        const groupRoomId = findGroupRoomId(rooms)
        if (groupRoomId) {
          await leaveChatRoom(groupRoomId)
        }
      } catch (e) {
        console.warn("채팅방 나가기 실패 - 무시하고 탈퇴 계속 진행:", e)
      }

      // 2. 모임 탈퇴
      await api.delete(`/groups/${groupId}/withdraw`, { headers })
      showToast("모임에서 탈퇴되었습니다.")

      setTimeout(() => router.push("/meeting"), 1500)
    } catch (error: any) {
      console.error("모임 탈퇴 실패:", error)
      showToast(`탈퇴 실패: ${error.response?.data?.message || "알 수 없는 오류"}`, "error")
    }
  }


  const closeModal = () => {
    setShowProfileModal(false)
    setShowMenuModal(false)
    setShowInviteModal(false)
    setSelectedMember(null)
  }

  const canCreateInviteLink = () => hasPermission("CREATE_INVITE_LINK")
  const canCreateDirectChat = () => hasPermission("CREATE_DIRECT_CHAT_ROOM")

  const sortedMembers = [...groupMembers].sort((a, b) => {
    if (currentUser && a.id === currentUser.id) return -1
    if (currentUser && b.id === currentUser.id) return 1
    const roleOrder = { LEADER: 3, SUB_LEADER: 2, MEMBER: 1 }
    return (roleOrder[b.role] || 0) - (roleOrder[a.role] || 0)
  })

  if (isLoading || permissionsLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>멤버 정보를 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className={styles.membersContainer}>
      <div className={styles.membersHeader}>
        <div className={styles.membersTitle}>
          <h2>
            멤버 <span>({sortedMembers.length})</span>
          </h2>
        </div>
        {canCreateInviteLink() && (
          <button className={styles.inviteButton} onClick={inviteMembers}>
            멤버 초대
          </button>
        )}
      </div>

      <div className={styles.membersList}>
        {sortedMembers.length === 0 ? (
          <div className={styles.emptyState}>멤버가 없습니다.</div>
        ) : (
          sortedMembers.map((member) => {
            const isCurrentUser = currentUser && member.id === currentUser.id
            const showMenu = !isCurrentUser && (isLeader() || canCreateDirectChat())

            return (
              <div key={member.id} className={`${styles.memberItem} ${isCurrentUser ? styles.currentUser : ""}`}>
                <img
                  src={member.profileImageUrl || "/placeholder.svg?height=48&width=48"}
                  alt={member.name}
                  className={styles.memberAvatar}
                  onClick={() => handleProfileClick(member.profileImageUrl || "", member.joinedAt)}
                />

                <div className={styles.memberInfo}>
                  <p className={styles.memberName}>{member.name}</p>
                  <p className={`${styles.memberRole} ${styles[member.role.toLowerCase().replace("_", "")]}`}>
                    {getRoleText(member.role)}
                  </p>
                </div>

                {showMenu && (
                  <button className={styles.memberMenu} onClick={() => handleMemberMenuClick(member)}>
                    ⋯
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {!isLeader() && currentUser && (
        <div className={styles.withdrawSection}>
          <button className={styles.withdrawButton} onClick={withdrawFromGroup}>
            모임 탈퇴
          </button>
        </div>
      )}

      {/* 프로필 모달 */}
      {showProfileModal && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <span className={styles.close} onClick={closeModal}>
              &times;
            </span>
            <img src={profileModalData.imageUrl || "/placeholder.svg"} alt="프로필" className={styles.modalImage} />
            <div className={styles.modalInfo}>
              <p>{profileModalData.joinDate}</p>
            </div>
          </div>
        </div>
      )}

      {/* 멤버 메뉴 모달 */}
      {showMenuModal && selectedMember && (
        <div className={styles.modal} onClick={closeModal}>
          <div className={`${styles.modalContent} ${styles.menuModalContent}`} onClick={(e) => e.stopPropagation()}>
            <span className={styles.close} onClick={closeModal}>
              &times;
            </span>
            <div className={styles.menuOptions}>
              {(isLeader() || canCreateDirectChat()) && (
                <div
                  className={styles.menuOption}
                  onClick={() => startDirectChat(selectedMember.id, selectedMember.name)}
                >
                  1:1 대화
                </div>
              )}
              {isLeader() && (
                <>
                  <div
                    className={`${styles.menuOption} ${styles.danger}`}
                    onClick={() => kickMember(selectedMember.id, selectedMember.name)}
                  >
                    강제 탈퇴
                  </div>
                  <div
                    className={`${styles.menuOption} ${styles.danger}`}
                    onClick={() => blockMember(selectedMember.id, selectedMember.name)}
                  >
                    차단
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 초대 모달 */}
      <ModalPortal isOpen={showInviteModal}>
        {inviteData && (
          <div className={styles.modal} onClick={closeModal}>
            <div className={`${styles.modalContent} ${styles.inviteModalContent}`} onClick={(e) => e.stopPropagation()}>
              <span className={styles.close} onClick={closeModal}>
                &times;
              </span>
              <h3>{inviteData.groupName} 초대</h3>

              <div className={styles.inviteInfo}>
                <p className={styles.inviteDescription}>{inviteData.groupDescription || "새로운 친구를 초대해보세요!"}</p>

                {inviteData.inviteLink ? (
                  <>
                    <div className={styles.inviteLinkContainer}>
                      <label>초대 링크</label>
                      <div className={styles.linkInputGroup}>
                        <input type="text" value={inviteData.inviteLink} readOnly />
                        <button
                          className={styles.copyBtn}
                          onClick={() => copyToClipboard(inviteData.inviteLink!, "초대 링크")}
                        >
                          복사
                        </button>
                      </div>
                    </div>

                    {inviteData.code && (
                      <div className={styles.inviteCodeContainer}>
                        <label>초대 코드</label>
                        <div className={styles.codeInputGroup}>
                          <input type="text" value={inviteData.code} readOnly />
                          <button
                            className={styles.copyBtn}
                            onClick={() => copyToClipboard(inviteData.code!, "초대 코드")}
                          >
                            복사
                          </button>
                        </div>
                      </div>
                    )}

                    <div className={styles.inviteActions}>
                      <button className={styles.refreshBtn} onClick={refreshInviteLink} disabled={isCreatingInvite}>
                        {isCreatingInvite ? "생성 중..." : "새 링크 생성"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className={styles.inviteActions}>
                    <button className={styles.createBtn} onClick={createInviteLink} disabled={isCreatingInvite}>
                      {isCreatingInvite ? "생성 중..." : "초대 링크 만들기"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </ModalPortal>

      {/* 토스트 메시지 */}
      {toast.show && <div className={`${styles.toast} ${styles.show} ${styles[toast.type]}`}>{toast.message}</div>}
    </div>
  )
}