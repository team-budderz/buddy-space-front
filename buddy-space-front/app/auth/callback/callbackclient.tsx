"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import api from "@/app/api"
import styles from "./callback.module.css"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const token        = params.get("token")
        const success      = params.get("success")
        const error        = params.get("error")
        const errorMessage = params.get("message")

        if (error) {
          setStatus("error")
          setMessage(decodeURIComponent(errorMessage || "로그인 중 오류가 발생했습니다."))
          return
        }

        if (success === "true" && token) {
          localStorage.setItem("accessToken", token)

          try {
            const { data: userData } = await api.get("/users/me", {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (userData.result?.email) {
              localStorage.setItem("userEmail", userData.result.email)
            }
          } catch (e) {
            console.warn("⚠️ 사용자 정보 조회 실패:", e)
          }

          setStatus("success")
          setMessage("로그인 성공!")
          router.replace("/meeting")
        } else {
          setStatus("error")
          setMessage("유효하지 않은 로그인 응답입니다.")
        }
      } catch (e) {
        setStatus("error")
        setMessage("로그인 처리 중 오류가 발생했습니다.")
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {status === "loading" && (
          <>
            <div className={styles.spinner}></div>
            <h2>로그인 처리 중...</h2>
            <p>구글 로그인을 완료하고 있습니다.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className={styles.successIcon}>✅</div>
            <h2>로그인 성공!</h2>
            <p>{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className={styles.errorIcon}>❌</div>
            <h2>로그인 실패</h2>
            <p>{message}</p>
            <div className={styles.buttonGroup}>
              <button
                className={styles.retryButton}
                onClick={() => router.replace("/login")}
              >
                다시 시도
              </button>
              <button
                className={styles.homeButton}
                onClick={() => router.replace("/")}
              >
                홈으로
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
