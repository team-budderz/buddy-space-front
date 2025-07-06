"use client"

import type React from "react"
import { useEffect } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import styles from "./grouplayout.module.css"
import { GroupPermissionsProvider, useGroupPermissions } from "@/app/components/hooks/usegrouppermissiont"

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const groupId = params.id as string

  const { isLoading, error, isLeader } = useGroupPermissions()

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual"
    }
  }, [])

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
    <GroupPermissionsProvider>
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
    </GroupPermissionsProvider>
  )
}
