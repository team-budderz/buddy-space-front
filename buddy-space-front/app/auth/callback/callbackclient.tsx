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
      console.log("AuthCallbackPage mounted")
      console.log("current search:", window.location.search)

      try { // 파라미터
        const params = new URLSearchParams(window.location.search)
        const token        = params.get("token")      // 토큰
        const success      = params.get("success")    // 성공 여부
        const error        = params.get("error")      // 에러
        const errorMessage = params.get("message")    // 에러 메시지

        console.log("🔑 Parsed params →", {
          token,
          success,
          error,
          errorMessage
        })

        if (error) {
          console.log("⚠️ OAuth error param detected:", error)
          setStatus("error")
          setMessage(decodeURIComponent(errorMessage || "로그인 중 오류가 발생했습니다."))
          return
        }

        if (success === "true" && token) {
          console.log("success === 'true' && token present, proceeding to store token")
          localStorage.setItem("accessToken", token)

          try {
            console.log("fetching /users/me with token")
            const { data: userData } = await api.get("/users/me", {
              headers: { Authorization: `Bearer ${token}` },
            })
            console.log("   /users/me response:", userData)
            if (userData.result?.email) {
              localStorage.setItem("userEmail", userData.result.email)
            }
          } catch (e) {
            console.warn("⚠️ 사용자 정보 조회 실패:", e)
          }

          console.log("setting status=success and redirecting to /meeting")
          setStatus("success")
          setMessage("로그인 성공!")
          router.replace("/meeting")
        } else {
          console.log("success/token 조건 불만족, showing error")
          setStatus("error")
          setMessage("유효하지 않은 로그인 응답입니다.")
        }
      } catch (e) {
        console.error("handleCallback 예외 발생:", e)
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
