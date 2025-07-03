"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import styles from "./homepage.module.css"

export default function HomePage() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:8080/oauth2/authorization/google"
  }

  const features = [
    {
      icon: "👥",
      title: "그룹 만들기",
      description: "친구들과 함께하는 특별한 공간을 만들어보세요",
    },
    {
      icon: "💬",
      title: "실시간 채팅",
      description: "언제 어디서나 친구들과 소통할 수 있어요",
    },
    {
      icon: "📸",
      title: "추억 공유",
      description: "소중한 순간들을 함께 나누고 기억해요",
    },
    {
      icon: "🎯",
      title: "미션 도전",
      description: "함께 목표를 세우고 달성해나가요",
    },
  ]

  return (
    <main className={styles.container}>
      <section className={`${styles.hero} ${isVisible ? styles.fadeIn : ""}`}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>
              <span className={styles.highlight}>벗터즈</span>에서
              <br />
              특별한 추억을 만들어요
            </h1>
            <p className={styles.subtitle}>
              친구들과 함께하는 모든 순간이 더욱 특별해집니다.
              <br />
              그룹을 만들고, 소통하고, 추억을 쌓아보세요!
            </p>
            <div className={styles.heroButtons}>
              <button onClick={() => router.push("/signup")} className={styles.primaryButton}>
                지금 시작하기
              </button>
              <button onClick={() => router.push("/login")} className={styles.secondaryButton}>
                로그인
              </button>
            </div>
          </div>
          <div className={styles.heroImage}>
            <div className={styles.floatingCard}>
              <div className={styles.cardHeader}>
                <div className={styles.avatar}></div>
                <div className={styles.cardInfo}>
                  <div className={styles.cardName}></div>
                  <div className={styles.cardTime}></div>
                </div>
              </div>
              <div className={styles.cardContent}></div>
              <div className={styles.cardActions}>
                <div className={styles.actionButton}></div>
                <div className={styles.actionButton}></div>
                <div className={styles.actionButton}></div>
              </div>
            </div>
            <div className={styles.floatingCard2}>
              <div className={styles.miniCard}>
                <div className={styles.miniAvatar}></div>
                <div className={styles.miniText}></div>
              </div>
              <div className={styles.miniCard}>
                <div className={styles.miniAvatar}></div>
                <div className={styles.miniText}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.featuresContainer}>
          <h2 className={styles.featuresTitle}>벗터즈와 함께라면</h2>
          <div className={styles.featuresGrid}>
            {features.map((feature, index) => (
              <div key={index} className={styles.featureCard} style={{ animationDelay: `${index * 0.1}s` }}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerContent}>
            <div className={styles.footerBrand}>
              <h3 className={styles.footerTitle}>벗터즈</h3>
              <p className={styles.footerDescription}>친구들과 함께하는 특별한 공간</p>
            </div>
            <div className={styles.footerLinks}>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>&copy; 2025 벗터즈. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
