"use client"
export const dynamic = 'force-dynamic';

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./invite.module.css";
import api from "@/app/api";

interface GroupInfo {
  groupId: number
  groupName: string
  description?: string
  memberCount?: number
  members?: any[]
}

interface ToastState {
  show: boolean
  message: string
  type: "success" | "error" | "warning" | "info"
}

export default function InvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentState, setCurrentState] = useState<"loading" | "login-required" | "invite-info" | "success" | "error">(
    "loading",
  )
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null)
  const [errorInfo, setErrorInfo] = useState({ title: "", message: "" })
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" })

  const showToast = (message: string, type: ToastState["type"] = "success") => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }))
    }, 3000)
  }

  useEffect(() => {
    const code = extractInviteCode()
    if (!code) {
      setCurrentState("error")
      setErrorInfo({
        title: "유효하지 않은 초대 링크입니다.",
        message: "초대 코드를 찾을 수 없습니다.",
      })
      return
    }
    setInviteCode(code)
    checkLoginStatus()
  }, [])

  const extractInviteCode = (): string | null => {
    const code = searchParams.get("code")
    if (code) return code

    const pathParts = window.location.pathname.split("/")
    const lastPart = pathParts[pathParts.length - 1]
    if (lastPart && lastPart !== "invite") {
      return lastPart
    }

    return null
  }

  const checkLoginStatus = async () => {
    const token = localStorage.getItem("accessToken")

    if (!token) {
      setCurrentState("login-required")
      return
    }

    try {
      const response = await api.get("/users/me")
      if (response.data.result) {
        setCurrentState("invite-info")
      } else {
        setCurrentState("login-required")
      }
    } catch (error) {
      console.error("로그인 상태 확인 실패:", error)
      setCurrentState("login-required")
    }
  }

  const joinGroup = async () => {
    if (isProcessing || !inviteCode) return

    setIsProcessing(true)

    try {
      const response = await api.post("/invites", `code=${encodeURIComponent(inviteCode)}`, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })

      if (response.data.result) {
        setGroupInfo(response.data.result)
        setCurrentState("success")

        setTimeout(() => {
          router.push(`/meeting/group/${response.data.result.groupId}`)
        }, 3000)
      }
    } catch (error: any) {
      console.error("모임 참여 실패:", error)
      setCurrentState("error")
      setErrorInfo({
        title: "참여 실패",
        message: error.response?.data?.message || "모임 참여 중 오류가 발생했습니다.",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const goToLogin = () => {
    const currentUrl = encodeURIComponent(window.location.href)
    router.push(`/login?redirect=${currentUrl}`)
  }

  const goToGroupMain = (groupId: number) => {
    router.push(`/meeting/group/${groupId}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isProcessing) {
      if (currentState === "login-required") {
        goToLogin()
      } else if (currentState === "invite-info") {
        joinGroup()
      }
    }
  }

  const renderContent = () => {
    switch (currentState) {
      case "loading":
        return (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>초대 정보를 확인하는 중...</p>
          </div>
        )

      case "login-required":
        return (
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>🔐</div>
            <h2 className={styles.errorTitle}>로그인이 필요합니다</h2>
            <p className={styles.errorMessage}>모임에 참여하려면 먼저 로그인해주세요.</p>
          </div>
        )

      case "invite-info":
        return (
          <div className={styles.groupInfo}>
            <h2 className={styles.groupName}>모임 초대</h2>
            <p className={styles.groupDescription}>
              초대 코드: <strong>{inviteCode}</strong>
              <br />
              아래 버튼을 클릭하여 모임에 참여하세요.
            </p>
          </div>
        )

      case "success":
        return (
          <div className={styles.successState}>
            <div className={styles.successIcon}>🎉</div>
            <h2 className={styles.successTitle}>참여 완료!</h2>
            <p className={styles.successMessage}>
              <strong>{groupInfo?.groupName}</strong> 모임에 성공적으로 참여했습니다.
            </p>
            <div className={styles.groupInfo}>
              <h3 className={styles.groupName}>{groupInfo?.groupName}</h3>
              <div className={styles.memberCount}>👥 멤버 {groupInfo?.members?.length || 0}명</div>
            </div>
          </div>
        )

      case "error":
        return (
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>❌</div>
            <h2 className={styles.errorTitle}>{errorInfo.title}</h2>
            <p className={styles.errorMessage}>{errorInfo.message}</p>
          </div>
        )

      default:
        return null
    }
  }

  const renderActions = () => {
    switch (currentState) {
      case "login-required":
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={goToLogin}>
              로그인하기
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => router.push("/")}>
              메인으로 돌아가기
            </button>
          </>
        )

      case "invite-info":
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={joinGroup} disabled={isProcessing}>
              {isProcessing ? "참여 중..." : "모임 참여하기"}
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => router.push("/")}>
              취소
            </button>
          </>
        )

      case "success":
        return (
          <>
            <button
              className={`${styles.btn} ${styles.btnSuccess}`}
              onClick={() => groupInfo && goToGroupMain(groupInfo.groupId)}
            >
              모임으로 이동
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => router.push("/")}>
              메인으로 이동
            </button>
          </>
        )

      case "error":
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => window.location.reload()}>
              다시 시도
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => router.push("/")}>
              메인으로 돌아가기
            </button>
          </>
        )

      default:
        return null
    }
  }

  return (
    <div className={styles.inviteContainer} onKeyDown={handleKeyDown}>
      <div className={styles.inviteCard}>
        <div className={styles.inviteHeader}>
          <div className={styles.logo}>🎯</div>
          <h1>모임 초대</h1>
        </div>

        <div className={styles.inviteContent}>{renderContent()}</div>

        <div className={styles.inviteActions}>{renderActions()}</div>
      </div>
    </div>
  )
}
