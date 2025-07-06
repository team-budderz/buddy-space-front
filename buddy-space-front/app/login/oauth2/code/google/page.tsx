'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GoogleOAuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const query = window.location.search
    const base = process.env.NEXT_PUBLIC_API_BASE_URL!
    fetch(`${base}/login/oauth2/code/google${query}`, {
      credentials: "include",
    })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text()
          console.error('[OAuth Callback] 응답 오류', {
            status: res.status,
            statusText: res.statusText,
            body: text,
          })
          throw new Error(`HTTP ${res.status}`)
        }
        const data = await res.json()
        console.log('[OAuth Callback] 토큰 응답:', data)
        localStorage.setItem('accessToken', data.accessToken)
        router.replace('/meeting')
      })
      .catch(err => {
        console.error('[OAuth Callback] 예외 발생:', err)
        alert('로그인에 실패했습니다. 콘솔을 확인하세요.')
        router.replace('/login')
      })
  }, [router])

  return <p>로그인 처리 중…</p>
}
