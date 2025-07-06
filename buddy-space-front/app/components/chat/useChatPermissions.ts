// useChatPermissions.ts
import { useState, useEffect, useCallback } from "react"
import api from "@/app/api"

type UserMembership = {
  id: number
  role: "LEADER" | "SUB_LEADER" | "MEMBER"
  joinedAt: string
}
type GroupPermission = {
  type: string
  role: "LEADER" | "SUB_LEADER" | "MEMBER"
}

const ROLE_LEVELS: Record<string, number> = {
  MEMBER: 1,
  SUB_LEADER: 2,
  LEADER: 3,
}

export function useChatPermissions(groupId: number) {
  const [membership, setMembership] = useState<UserMembership | null>(null)
  const [permissions, setPermissions] = useState<GroupPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPermissions = useCallback(async () => {
    setIsLoading(true)
    try {
      const [mRes, pRes] = await Promise.all([
        api.get(`/groups/${groupId}/membership`),
        api.get(`/groups/${groupId}/permissions`),
      ])
      if (mRes.status === 200) {
        setMembership(mRes.data.result)
      }
      if (pRes.status === 200) {
        setPermissions(pRes.data.result.permissions || [])
      }
    } finally {
      setIsLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const hasRoleLevel = (userRole: string, requiredRole: string) => {
    return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[requiredRole] || 0)
  }

  const hasPermission = (type: string): boolean => {
    if (!membership) return false
    const perm = permissions.find((p) => p.type === type)
    return !!perm && hasRoleLevel(membership.role, perm.role)
  }

  return { isLoading, hasPermission, membership }
}
