"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import styles from "./requested.module.css"
import api from "@/app/api"

interface UserInfo {
  name: string
  email: string
  profileImageUrl?: string
}

interface RequestedGroup {
  id: number
  name: string
  description?: string
  type: "ONLINE" | "OFFLINE" | "HYBRID"
  interest: "HOBBY" | "FAMILY" | "SCHOOL" | "BUSINESS" | "EXERCISE" | "GAME" | "STUDY" | "FAN" | "OTHER"
  access: "PUBLIC" | "PRIVATE"
  address?: string
  coverImageUrl?: string
}

interface ToastState {
  show: boolean
  message: string
  type: "success" | "error" | "warning" | "info"
}

export default function RequestedPage() {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [requestedGroups, setRequestedGroups] = useState<RequestedGroup[]>([])
  const [filteredGroups, setFilteredGroups] = useState<RequestedGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" })

  const [typeFilter, setTypeFilter] = useState("")
  const [interestFilter, setInterestFilter] = useState("")
  const [sortBy, setSortBy] = useState("recent")

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<RequestedGroup | null>(null)

  useEffect(() => {
    fetchUserInfo()
    fetchRequestedGroups()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [requestedGroups, typeFilter, interestFilter, sortBy])

  const fetchUserInfo = async () => {
    try {
      const response = await api.get("/users/me")
      setUserInfo(response.data.result)
    } catch (error) {
      console.error("사용자 정보 조회 실패:", error)
    }
  }

  const fetchRequestedGroups = async () => {
    try {
      setIsLoading(true)
      const response = await api.get("/groups/my-requested")
      const groups = response.data.result || []
      setRequestedGroups(groups)
      setFilteredGroups(groups)
    } catch (error) {
      console.error("가입 요청 목록 조회 실패:", error)
      showToast("가입 요청 목록을 불러올 수 없습니다.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    const filtered = requestedGroups.filter((group) => {
      const typeMatch = !typeFilter || group.type === typeFilter
      const interestMatch = !interestFilter || group.interest === interestFilter
      return typeMatch && interestMatch
    })

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name)
        case "type":
          return a.type.localeCompare(b.type)
        case "interest":
          return a.interest.localeCompare(b.interest)
        case "recent":
        default:
          return b.id - a.id
      }
    })

    setFilteredGroups(filtered)
  }

  const showToast = (message: string, type: ToastState["type"] = "success") => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }))
    }, 3000)
  }

  const handleCancelRequest = (group: RequestedGroup) => {
    setSelectedGroup(group)
    setShowCancelModal(true)
  }

  const confirmCancelRequest = async () => {
    if (!selectedGroup) return

    try {
      const response = await api.delete(`/groups/${selectedGroup.id}/cancel-requests`)

      if (response.status === 200) {
        setRequestedGroups((prev) => prev.filter((group) => group.id !== selectedGroup.id))
        setShowCancelModal(false)
        setSelectedGroup(null)
        showToast("가입 요청이 취소되었습니다.")
      }
    } catch (error: any) {
      console.error("요청 취소 실패:", error)
      const errorMessage = error.response?.data?.message || "요청 취소에 실패했습니다."
      showToast(errorMessage, "error")
    }
  }

  const getGroupTypeText = (type: string) => {
    const types = {
      ONLINE: "온라인",
      OFFLINE: "오프라인",
      HYBRID: "온·오프라인",
    }
    return types[type as keyof typeof types] || "오프라인"
  }

  const getGroupTypeClass = (type: string) => {
    const classes = {
      ONLINE: "online",
      OFFLINE: "offline",
      HYBRID: "hybrid",
    }
    return classes[type as keyof typeof classes] || "offline"
  }

  const getGroupInterestText = (interest: string) => {
    const interests = {
      HOBBY: "취미",
      FAMILY: "가족",
      SCHOOL: "학교",
      BUSINESS: "업무",
      EXERCISE: "운동",
      GAME: "게임",
      STUDY: "스터디",
      FAN: "팬",
      OTHER: "기타",
    }
    return interests[interest as keyof typeof interests] || "기타"
  }

  const getGroupInterestClass = (interest: string) => {
    const classes = {
      HOBBY: "hobby",
      FAMILY: "family",
      SCHOOL: "school",
      BUSINESS: "business",
      EXERCISE: "exercise",
      GAME: "game",
      STUDY: "study",
      FAN: "fan",
      OTHER: "other",
    }
    return classes[interest as keyof typeof classes] || "other"
  }

  if (isLoading) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>가입 요청 목록을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.profileContainer}>
      <div className={styles.profileLayout}>
        <div className={styles.sidebar}>
          <div className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <div className={styles.profileAvatar}>
                {userInfo?.profileImageUrl ? (
                  <img src={userInfo.profileImageUrl || "/placeholder.svg"} alt={userInfo.name} />
                ) : (
                  <div className={styles.avatarFallback}>{userInfo?.name?.charAt(0).toUpperCase() || "U"}</div>
                )}
              </div>
              <h2>{userInfo?.name}</h2>
              <p>{userInfo?.email}</p>
            </div>
            <div className={styles.sidebarNav}>
              <button className={styles.navItem} onClick={() => router.push("/profile")}>
                <span className={styles.navIcon}>👤</span>
                프로필 관리
              </button>
              <button className={`${styles.navItem} ${styles.active}`}>
                <span className={styles.navIcon}>👥</span>
                가입 요청 관리
              </button>
            </div>
          </div>
        </div>

        <div className={styles.mainContent}>
          <div className={styles.infoCard}>
            <div className={styles.cardHeader}>
              <div className={styles.headerLeft}>
                <h3>
                  <span className={styles.cardIcon}>📋</span>
                  가입 요청중인 벗터
                </h3>
                <h4>현재 가입 신청한 모임들을 관리할 수 있습니다.</h4>
              </div>
              <span className={styles.statsBadge}>{filteredGroups.length}개 요청</span>
            </div>

            <div className={styles.cardContent}>
              <div className={styles.filterControls}>
                <div className={styles.filterGroup}>
                  <label>모임 유형</label>
                  <select
                    className={styles.filterSelect}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="">전체</option>
                    <option value="ONLINE">온라인</option>
                    <option value="OFFLINE">오프라인</option>
                    <option value="HYBRID">온·오프라인</option>
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label>관심사</label>
                  <select
                    className={styles.filterSelect}
                    value={interestFilter}
                    onChange={(e) => setInterestFilter(e.target.value)}
                  >
                    <option value="">전체</option>
                    <option value="HOBBY">취미</option>
                    <option value="FAMILY">가족</option>
                    <option value="SCHOOL">학교</option>
                    <option value="BUSINESS">업무</option>
                    <option value="EXERCISE">운동</option>
                    <option value="GAME">게임</option>
                    <option value="STUDY">스터디</option>
                    <option value="FAN">팬</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>

                <div className={styles.filterGroup}>
                  <label>정렬</label>
                  <select className={styles.filterSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="recent">최근 순</option>
                    <option value="name">이름 순</option>
                    <option value="type">유형 순</option>
                    <option value="interest">관심사 순</option>
                  </select>
                </div>
              </div>

              {filteredGroups.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📋</div>
                  <h3>가입 요청한 내역이 없습니다.</h3>
                  <button type="button" className={styles.browseButton} onClick={() => router.push("/meeting")}>
                    벗터 둘러보기
                  </button>
                </div>
              ) : (
                <div className={styles.requestsList}>
                  {filteredGroups.map((group) => (
                    <div key={group.id} className={styles.requestCard}>
                      <div className={styles.requestCardContent}>
                        {group.coverImageUrl ? (
                          <img
                            src={group.coverImageUrl || "/placeholder.svg"}
                            alt={group.name}
                            className={styles.groupImage}
                          />
                        ) : (
                          <div className={styles.groupImageFallback}>{group.name.charAt(0).toUpperCase()}</div>
                        )}

                        <div className={styles.groupInfo}>
                          <div className={styles.groupHeader}>
                            <h3 className={styles.groupName}>{group.name}</h3>
                            <div className={styles.groupBadges}>
                              <span
                                className={`${styles.groupBadge} ${styles.badgeType} ${styles[getGroupTypeClass(group.type)]}`}
                              >
                                {getGroupTypeText(group.type)}
                              </span>
                              <span
                                className={`${styles.groupBadge} ${styles.badgeInterest} ${styles[getGroupInterestClass(group.interest)]}`}
                              >
                                {getGroupInterestText(group.interest)}
                              </span>
                              <span
                                className={`${styles.groupBadge} ${styles.badgeAccess} ${group.access === "PRIVATE" ? styles.private : ""}`}
                              >
                                {group.access === "PUBLIC" ? "공개" : "비공개"}
                              </span>
                            </div>
                          </div>

                          <p className={styles.groupDescription}>{group.description || "설명이 없습니다."}</p>

                          {group.address && <p className={styles.groupAddress}>📍 {group.address}</p>}
                        </div>

                        <div className={styles.requestActions}>
                          <span className={styles.requestStatus}>승인 대기중</span>
                          <button className={styles.cancelRequestBtn} onClick={() => handleCancelRequest(group)}>
                            요청 취소
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCancelModal && selectedGroup && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>가입 요청 취소</h3>
              <button className={styles.modalClose} onClick={() => setShowCancelModal(false)}>
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.cancelGroupInfo}>
                <img
                  src={selectedGroup.coverImageUrl || "/placeholder.svg?height=60&width=60"}
                  alt={selectedGroup.name}
                  className={styles.cancelGroupImage}
                />
                <div className={styles.cancelGroupDetails}>
                  <h4>{selectedGroup.name}</h4>
                  <p>{selectedGroup.description || "설명이 없습니다."}</p>
                </div>
              </div>
              <p className={styles.modalDescription}>정말로 이 모임의 가입 요청을 취소하시겠습니까?</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowCancelModal(false)}>
                취소
              </button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={confirmCancelRequest}>
                요청 취소
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && <div className={`${styles.toast} ${styles[toast.type]} ${styles.show}`}>{toast.message}</div>}
    </div>
  )
}
