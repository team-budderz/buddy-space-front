"use client"

import type React from "react"
import { useState, useEffect, createContext, useContext } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import api from "@/app/api"
import styles from "./grouplayout.module.css"

const ROLE_LEVELS = {
  MEMBER: 1,
  SUB_LEADER: 2,
  LEADER: 3,
}

interface UserMembership {
  id: number
  role: "LEADER" | "SUB_LEADER" | "MEMBER"
  joinedAt: string
}

interface GroupPermission {
  type: string
  role: "LEADER" | "SUB_LEADER" | "MEMBER"
}

interface GroupInfo {
  groupId: number
  groupName: string
}

interface GroupPermissionsContextType {
  currentUserMembership: UserMembership | null
  groupPermissions: GroupPermission[]
  groupInfo: GroupInfo | null
  isLoading: boolean
  hasPermission: (permissionType: string) => boolean
  hasRoleLevel: (userRole: string, requiredRole: string) => boolean
  isLeader: () => boolean
  isSubLeaderOrAbove: () => boolean
  isMemberOrAbove: () => boolean
  getCurrentUserRole: () => string | null
  getCurrentUserId: () => number | null
  refreshPermissions: () => Promise<void>
}

const GroupPermissionsContext = createContext<GroupPermissionsContextType | null>(null)

export function useGroupPermissions() {
  const context = useContext(GroupPermissionsContext)
  if (!context) {
    throw new Error("useGroupPermissions must be used within GroupPermissionsProvider")
  }
  return context
}

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const groupId = params.id as string

  const [currentUserMembership, setCurrentUserMembership] = useState<UserMembership | null>(null)
  const [groupPermissions, setGroupPermissions] = useState<GroupPermission[]>([])
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initializePermissions = async () => {
    if (!groupId) {
      setError("모임 ID를 찾을 수 없습니다.")
      return
    }

    try {
      setIsLoading(true)

      const [membershipResponse, permissionsResponse] = await Promise.all([
        api.get(`/groups/${groupId}/membership`),   // 자동으로 Authorization 헤더 포함
        api.get(`/groups/${groupId}/permissions`),  // 마찬가지
      ])

      if (membershipResponse.status === 200 && membershipResponse.data.result) {
        setCurrentUserMembership(membershipResponse.data.result)
      } else {
        throw new Error("멤버십 정보를 불러올 수 없습니다.")
      }

      if (permissionsResponse.status === 200 && permissionsResponse.data.result) {
        setGroupPermissions(permissionsResponse.data.result.permissions || [])
        setGroupInfo({
          groupId: permissionsResponse.data.result.groupId,
          groupName: permissionsResponse.data.result.groupName,
        })
      } else {
        throw new Error("권한 정보를 불러올 수 없습니다.")
      }
    } catch (error: any) {
      console.error("권한 초기화 실패:", error)
      setError(error.message || "권한 정보를 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    initializePermissions()
  }, [groupId])

  const hasRoleLevel = (userRole: string, requiredRole: string): boolean => {
    if (!userRole || !requiredRole) return false

    const userLevel = ROLE_LEVELS[userRole as keyof typeof ROLE_LEVELS] || 0
    const requiredLevel = ROLE_LEVELS[requiredRole as keyof typeof ROLE_LEVELS] || 0

    return userLevel >= requiredLevel
  }

  const hasPermission = (permissionType: string): boolean => {
    if (!currentUserMembership || !groupPermissions.length) {
      return false
    }

    const userRole = currentUserMembership.role
    const permission = groupPermissions.find((p) => p.type === permissionType)

    if (!permission) {
      return false
    }

    return hasRoleLevel(userRole, permission.role)
  }

  const getCurrentUserRole = (): string | null => {
    return currentUserMembership?.role || null
  }

  const getCurrentUserId = (): number | null => {
    return currentUserMembership?.id || null
  }

  const isLeader = (): boolean => {
    return getCurrentUserRole() === "LEADER"
  }

  const isSubLeaderOrAbove = (): boolean => {
    const role = getCurrentUserRole()
    return role === "SUB_LEADER" || role === "LEADER"
  }

  const isMemberOrAbove = (): boolean => {
    const role = getCurrentUserRole()
    return role === "MEMBER" || role === "SUB_LEADER" || role === "LEADER"
  }

  const refreshPermissions = async (): Promise<void> => {
    await initializePermissions()
  }

  const tabs = [
    { name: "게시글", path: "posts", icon: "📝" },
    { name: "일정", path: "schedules", icon: "📅" },
    { name: "미션", path: "missions", icon: "🎯" },
    { name: "투표", path: "votes", icon: "🗳️" },
    { name: "사진첩", path: "photos", icon: "📸" },
    { name: "멤버", path: "members", icon: "👥" },
    { name: "설정", path: "setting", icon: "⚙️", requiresLeader: true },
  ]

  const getCurrentTab = () => {
    const pathSegments = pathname.split("/")
    const lastSegment = pathSegments[pathSegments.length - 1]
    return lastSegment === groupId ? "" : lastSegment
  }

  const currentTab = getCurrentTab()

  const contextValue: GroupPermissionsContextType = {
    currentUserMembership,
    groupPermissions,
    groupInfo,
    isLoading,
    hasPermission,
    hasRoleLevel,
    isLeader,
    isSubLeaderOrAbove,
    isMemberOrAbove,
    getCurrentUserRole,
    getCurrentUserId,
    refreshPermissions,
  }

  if (error) {
    return (
      <main className={styles.main}>
        <div className={styles.errorContainer}>
          <div className={styles.errorMessage}>
            <h2>오류가 발생했습니다</h2>
            <p>{error}</p>
            <button onClick={() => router.push("/meeting")} className={styles.backButton}>
              모임 목록으로 돌아가기
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <GroupPermissionsContext.Provider value={contextValue}>
      <main className={styles.main}>
        <nav className={styles.groupNav}>
          {tabs.map((tab) => {
            if (tab.requiresLeader && !isLeader()) {
              return null
            }

            const href = `/meeting/group/${groupId}${tab.path ? `/${tab.path}` : ""}`
            const isActive = currentTab === tab.path

            return (
              <Link
                key={tab.path || "main"}
                href={href}
                className={`${styles.navLink} ${isActive ? styles.active : ""}`}
              >
                <span className={styles.tabIcon}>{tab.icon}</span>
                <span className={styles.tabText}>{tab.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className={styles.groupContent}>
          {isLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p>권한 정보를 불러오는 중...</p>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </GroupPermissionsContext.Provider>
  )
}

export const usePermissionChecker = () => {
  const { hasPermission } = useGroupPermissions()

  return {
    canCreatePost: () => hasPermission("CREATE_POST"),
    canDeletePost: () => hasPermission("DELETE_POST"),
    canCreateSchedule: () => hasPermission("CREATE_SCHEDULE"),
    canDeleteSchedule: () => hasPermission("DELETE_SCHEDULE"),
    canCreateMission: () => hasPermission("CREATE_MISSION"),
    canDeleteMission: () => hasPermission("DELETE_MISSION"),
    canCreateVote: () => hasPermission("CREATE_VOTE"),
    canDeleteVote: () => hasPermission("DELETE_VOTE"),
    canCreateDirectChat: () => hasPermission("CREATE_DIRECT_CHAT_ROOM"),
    canInviteChatParticipant: () => hasPermission("INVITE_CHAT_PARTICIPANT"),
    canKickChatParticipant: () => hasPermission("KICK_CHAT_PARTICIPANT"),
    canCreateInviteLink: () => hasPermission("CREATE_INVITE_LINK"),
    canManagePosts: () => hasPermission("CREATE_POST") || hasPermission("DELETE_POST"),
    canManageSchedules: () => hasPermission("CREATE_SCHEDULE") || hasPermission("DELETE_SCHEDULE"),
    canManageMissions: () => hasPermission("CREATE_MISSION") || hasPermission("DELETE_MISSION"),
    canManageVotes: () => hasPermission("CREATE_VOTE") || hasPermission("DELETE_VOTE"),
    canManageChat: () =>
      hasPermission("CREATE_DIRECT_CHAT_ROOM") ||
      hasPermission("INVITE_CHAT_PARTICIPANT") ||
      hasPermission("KICK_CHAT_PARTICIPANT"),
  }
}
