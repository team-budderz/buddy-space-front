"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import api from "@/app/api"            
import styles from "./callback.module.css"

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams.get("token")
        const success = searchParams.get("success")
        const error = searchParams.get("error")
        const errorMessage = searchParams.get("message")

        if (error) {
          setStatus("error")
          setMessage(decodeURIComponent(errorMessage || "로그인 중 오류가 발생했습니다."))
          return
        }

        if (success === "true" && token) {
          // 토큰 저장
          localStorage.setItem("accessToken", token)

          // 사용자 정보 조회
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
  }, [searchParams, router])

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
              <button className={styles.retryButton} onClick={() => router.push("/login")}>
                다시 시도
              </button>
              <button className={styles.homeButton} onClick={() => router.push("/")}>
                홈으로
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}