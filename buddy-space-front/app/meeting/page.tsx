"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import api from "@/app/api"
import styles from "./meeting.module.css"

interface Group {
    groupId: number
    groupName: string
    groupCoverImageUrl?: string
    groupType: "ONLINE" | "OFFLINE" | "HYBRID"
    groupInterest: "HOBBY" | "FAMILY" | "SCHOOL" | "BUSINESS" | "EXERCISE" | "GAME" | "STUDY" | "FAN" | "OTHER"
    memberCount: number
    joinStatus: "APPROVED" | "REQUESTED" | "BLOCKED" | null
}

interface User {
    address?: string
}

const groupTypeMap = {
    ONLINE: "온라인",
    OFFLINE: "오프라인",
    HYBRID: "온·오프라인",
}

const groupInterestMap = {
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

const interests = [
    { value: "", label: "전체" },
    { value: "HOBBY", label: "취미" },
    { value: "FAMILY", label: "가족" },
    { value: "SCHOOL", label: "학교" },
    { value: "BUSINESS", label: "업무" },
    { value: "EXERCISE", label: "운동" },
    { value: "GAME", label: "게임" },
    { value: "STUDY", label: "스터디" },
    { value: "FAN", label: "팬" },
    { value: "OTHER", label: "기타" },
]

export default function MeetingPage() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<"my" | "online" | "offline">("my")
    const [groups, setGroups] = useState<Group[]>([])
    const [currentSort, setCurrentSort] = useState("popular")
    const [currentInterest, setCurrentInterest] = useState("")
    const [loggedInUser, setLoggedInUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        fetchGroups(activeTab)
        loadUserInfo()
    }, [activeTab, currentSort, currentInterest])

    const loadUserInfo = async () => {
        try {
            const response = await api.get("/users/me")
            if (response.data.result) {
                setLoggedInUser(response.data.result)
            }
        } catch (error) {
            console.error("사용자 정보 로드 실패:", error)
        }
    }

    const extractDong = (address: string) => {
        if (!address) return ""
        const parts = address.split(" ")
        return parts.length > 0 ? parts[parts.length - 1] : address
    }

    const fetchGroups = async (tabType: "my" | "online" | "offline") => {
        setIsLoading(true)
        let url = ""

        if (tabType === "my") {
            url = `/groups/my`
        } else if (tabType === "online") {
            url = `/groups/on?sort=${currentSort}`
            if (currentInterest) {
                url += `&interest=${currentInterest}`
            }
        } else if (tabType === "offline") {
            url = `/groups/off?sort=${currentSort}`
            if (currentInterest) {
                url += `&interest=${currentInterest}`
            }
        }

        try {
            const res = await api.get(url)
            const data = res.data
            setGroups(data.result.content || [])
        } catch (err) {
            console.error("모임 불러오기 실패", err)
            setGroups([])
        } finally {
            setIsLoading(false)
        }
    }

    const handleJoinRequest = async (groupId: number, groupName: string) => {
        try {
            const res = await api.post(`/groups/${groupId}/members/requests`)
            const data = res.data

            if (res.status === 200 && data.result) {
                alert("참여 요청이 완료되었습니다.")
                fetchGroups(activeTab)
            } else {
                alert(data.message || "참여 요청 실패")
            }
        } catch (err: any) {
            console.error("참여 요청 실패", err)
            alert("참여 요청 중 오류가 발생했습니다.")
        }
    }

    const handleTabChange = (tab: "my" | "online" | "offline") => {
        setActiveTab(tab)
        if (tab === "online" || tab === "offline") {
            setCurrentSort("popular")
            setCurrentInterest("")
        }
    }

    const handleSortChange = (sort: string) => {
        setCurrentSort(sort)
    }

    const handleInterestChange = (interest: string) => {
        setCurrentInterest(interest)
    }

    const CreateCard = () => (
        <div className={styles.createCard} onClick={() => router.push("/meeting/create")}>
            <div className={styles.plusIcon}>＋</div>
            <div>만들기</div>
        </div>
    )

    const GroupCard = ({ group }: { group: Group }) => {
        const canJoin = group.joinStatus !== "APPROVED"

        const handleCardClick = () => {
            if (group.joinStatus === "APPROVED") {
                router.push(`/meeting/group/${group.groupId}/posts`)
            }
        }

        const handleJoinClick = (e: React.MouseEvent) => {
            e.stopPropagation()

            if (group.joinStatus === "BLOCKED") {
                alert("가입 요청할 수 없는 모임입니다.")
                return
            }

            if (group.joinStatus === "REQUESTED") {
                alert("이미 가입 요청 중인 모임입니다.")
                return
            }

            handleJoinRequest(group.groupId, group.groupName)
        }

        return (
            <div className={styles.groupCard} onClick={handleCardClick}>
                <img src={group.groupCoverImageUrl || "/placeholder.svg?height=160&width=300"} alt={group.groupName} />
                <div className={styles.groupInfo}>
                    <h3>{group.groupName}</h3>
                    <div className={styles.groupMeta}>
                        {groupTypeMap[group.groupType] || group.groupType} /
                        {groupInterestMap[group.groupInterest] || group.groupInterest} · 멤버 {group.memberCount}명
                    </div>
                    {canJoin && (
                        <button onClick={handleJoinClick} disabled={group.joinStatus === "REQUESTED"}>
                            {group.joinStatus === "REQUESTED" ? "가입 요청 중" : "참여하기"}
                        </button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <main className={styles.mainContainer}>
            <div className={styles.contentWrapper}>

            <div className={styles.tabsContainer}>
                <div className={styles.tabs}>
                    <div
                        className={`${styles.tab} ${activeTab === "my" ? styles.active : ""}`}
                        onClick={() => handleTabChange("my")}
                    >
                        <span className={styles.tabIcon}>👥</span>
                        <span className={styles.tabText}>내 모임</span>
                    </div>
                    <div
                        className={`${styles.tab} ${activeTab === "online" ? styles.active : ""}`}
                        onClick={() => handleTabChange("online")}
                    >
                        <span className={styles.tabIcon}>💻</span>
                        <span className={styles.tabText}>온라인</span>
                    </div>
                    <div
                        className={`${styles.tab} ${activeTab === "offline" ? styles.active : ""}`}
                        onClick={() => handleTabChange("offline")}
                    >
                        <span className={styles.tabIcon}>🏢</span>
                        <span className={styles.tabText}>오프라인</span>
                    </div>
                </div>
            </div>

            {(activeTab === "online" || activeTab === "offline") && (
                <div className={styles.interestFilterContainer}>
                    <div className={styles.interestFilters}>
                        {interests.map((interest) => (
                            <button
                                key={interest.value}
                                className={`${styles.interestFilter} ${currentInterest === interest.value ? styles.active : ""}`}
                                onClick={() => handleInterestChange(interest.value)}
                            >
                                {interest.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.contentHeader}>
                {(activeTab === "online" || activeTab === "offline") && (
                    <div className={styles.sortOptions}>
                        <select
                            className={styles.sortSelect}
                            value={currentSort}
                            onChange={(e) => handleSortChange(e.target.value)}
                        >
                            <option value="popular">인기순</option>
                            <option value="latest">최신순</option>
                        </select>
                    </div>
                )}

                {activeTab === "offline" && loggedInUser?.address && (
                    <div className={styles.locationBadge}>
                        📍{extractDong(loggedInUser.address)}
                    </div>
                )}
            </div>


            <div className={styles.groupGrid}>
                {activeTab === "my" && <CreateCard />}
                {isLoading ? (
                    <div className={styles.loading}>모임을 불러오는 중...</div>
                ) : (
                    groups.map((group) => <GroupCard key={group.groupId} group={group} />)
                )}
            </div>
        </div>
        </main>
    )
}
