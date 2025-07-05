"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import styles from "./callback.module.css"

export default function AuthCallbackPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
    const [message, setMessage] = useState("")

    useEffect(() => {
        const handleCallback = async () => {
            try {
                console.log("🔍 OAuth2 콜백 처리 시작")
                console.log("🔍 URL 파라미터:", Object.fromEntries(searchParams.entries()))

                // URL 파라미터에서 토큰과 상태 확인
                const token = searchParams.get("token")
                const success = searchParams.get("success")
                const error = searchParams.get("error")
                const errorMessage = searchParams.get("message")

                if (error) {
                    console.error("❌ OAuth2 에러:", error, errorMessage)
                    setStatus("error")
                    setMessage(decodeURIComponent(errorMessage || "로그인 중 오류가 발생했습니다."))
                    return
                }

                if (success === "true" && token) {
                    console.log("✅ OAuth2 성공, 토큰 저장 중...")

                    // 토큰을 localStorage에 저장
                    localStorage.setItem("accessToken", token)
                    console.log("✅ AccessToken 저장 완료")

                    // 사용자 정보 가져오기
                    try {
                        console.log("🔍 사용자 정보 조회 중...")
                        const response = await fetch("http://localhost:8080/api/users/me", {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                "Content-Type": "application/json",
                            },
                            credentials: "include", // 쿠키 포함
                        })

                        console.log("🔍 사용자 정보 응답:", response.status)

                        if (response.ok) {
                            const userData = await response.json()
                            console.log("✅ 사용자 정보:", userData)

                            if (userData.result?.email) {
                                localStorage.setItem("userEmail", userData.result.email)
                            }
                        } else {
                            console.warn("⚠️ 사용자 정보 가져오기 실패:", response.status)
                        }
                    } catch (err) {
                        console.warn("⚠️ 사용자 정보 가져오기 오류:", err)
                    }

                    console.log("🚀 메인 페이지로 리다이렉트")
                    router.replace("/meeting")

                } else {
                    console.error("❌ 유효하지 않은 응답:", { success, token: !!token })
                    setStatus("error")
                    setMessage("유효하지 않은 로그인 응답입니다.")
                }
            } catch (err) {
                console.error("❌ 콜백 처리 오류:", err)
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
                        <div className={styles.progressBar}>
                            <div className={styles.progressFill}></div>
                        </div>
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
