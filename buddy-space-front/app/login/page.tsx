"use client"

import type React from "react"
import { useState } from "react"
import axios from "axios"
import { useRouter } from "next/navigation"
import Link from "next/link"
import styles from "./login.module.css"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const AUTH_BASE = process.env.NEXT_PUBLIC_AUTH_BASE_URL!;

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!passwordRegex.test(password)) {
      setError("비밀번호 형식이 올바르지 않습니다. (8자 이상, 대소문자 포함, 숫자 및 특수문자(@$!%*?&#) 포함)")
      setIsLoading(false)
      return
    }

    try {
      const res = await axios.post(
        `${API_BASE}/users/login`, { email, password },
        {
          withCredentials: true,
        },
      )

      console.log("응답 전체", res)
      console.log("응답 데이터", res.data)

      localStorage.setItem("accessToken", res.data.result.accessToken)
      localStorage.setItem("userEmail", email)
      localStorage.setItem("userPassword", password)

      // 쿠키 저장
      document.cookie = `accessToken=${res.data.result.accessToken}; path=/; SameSite=None; Secure`;

      router.push("/meeting")
    } catch (error) {
      setError("로그인 실패: 이메일 또는 비밀번호를 확인하세요.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    // 기존 OAuth2 엔드포인트 사용
   window.location.href = `${AUTH_BASE}/oauth2/authorization/google`
  }

  return (
    <div className={styles.container}>
      <div className={styles.loginWrapper}>
        <div className={styles.header}>
          <h1 className={styles.title}>로그인</h1>
          <p className={styles.subtitle}>계정에 로그인하여 서비스를 이용하세요</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              이메일
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              className={styles.input}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              비밀번호
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className={styles.input}
              required
              onKeyDown={(e) => {
                if (e.getModifierState && e.getModifierState('CapsLock')) {
                  setCapsLockOn(true);
                } else {
                  setCapsLockOn(false);
                }
              }}
            />
          </div>

          {capsLockOn && <div className={styles.capsLockMessage}>CAPS LOCK이 켜져 있습니다.</div>}
          {error && <div className={styles.errorMessage}>{error}</div>}

          <button type="submit" className={styles.loginButton} disabled={isLoading}>
            {isLoading ? (
              <div className={styles.loadingSpinner}>
                <div className={styles.spinner}></div>
                로그인 중...
              </div>
            ) : (
              "로그인"
            )}
          </button>
        </form>

        <div className={styles.divider}>
          <span>또는</span>
        </div>

        <div className={styles.socialLogin}>
          <button className={styles.socialButton} type="button" onClick={handleGoogleLogin}>
            <svg className={styles.socialIcon} viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google로 로그인
          </button>
        </div>

        <div className={styles.footer}>
          <p>
            계정이 없으신가요? <Link href="/signup">회원가입</Link>
          </p>
          <Link href="/forgot-password" className={styles.forgotPassword}>
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </div>
    </div>
  )
}
