"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import api from "@/app/api"
import styles from "./create.module.css"

interface FormData {
  name: string
  access: "PUBLIC" | "PRIVATE" | ""
  type: "ONLINE" | "OFFLINE" | "HYBRID" | ""
  interest: "HOBBY" | "FAMILY" | "SCHOOL" | "BUSINESS" | "EXERCISE" | "GAME" | "STUDY" | "FAN" | "OTHER" | ""
}

export default function CreatePage() {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>({
    name: "",
    access: "",
    type: "",
    interest: "",
  })
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showError("파일 크기는 5MB 이하여야 합니다.")
        e.target.value = ""
        return
      }

      if (!file.type.startsWith("image/")) {
        showError("이미지 파일만 업로드 가능합니다.")
        e.target.value = ""
        return
      }

      setCoverImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setCoverImage(null)
      setPreviewUrl("")
    }
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errorMessage) {
      clearError()
    }
  }

  const showError = (message: string) => {
    setErrorMessage(message)
  }

  const showSuccess = (message: string) => {
    setErrorMessage(message)
  }

  const clearError = () => {
    setErrorMessage("")
  }

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      showError("모임 이름을 입력해주세요.")
      return false
    }

    if (!formData.access) {
      showError("공개 설정을 선택해주세요.")
      return false
    }

    if (!formData.type) {
      showError("모임 유형을 선택해주세요.")
      return false
    }

    if (!formData.interest) {
      showError("관심사를 선택해주세요.")
      return false
    }

    return true
  }

  const loadChatRooms = async () => {
    try {
      const token = localStorage.getItem("accessToken")
      if (!token) {
        console.error("토큰이 없습니다.")
        return
      }

      const response = await fetch(`http://localhost:8080/api/chat/rooms/my`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        // 채팅방 목록 업데이트
        console.log("채팅방 목록:", data.result)
      }
    } catch (error) {
      console.error("채팅방 목록 로드 실패:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const submitFormData = new FormData()

      const request = new Blob(
        [
          JSON.stringify({
            name: formData.name,
            access: formData.access,
            type: formData.type,
            interest: formData.interest,
          }),
        ],
        { type: "application/json" }
      )

      submitFormData.append("request", request)

      if (coverImage) {
        submitFormData.append("coverImage", coverImage)
      }

      // 1. 그룹 생성 요청
      const response = await api.post("/groups", submitFormData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
      console.log("생성된 그룹 응답:", response.data)

      // 그룹 ID 확인
      const result = response.data.result
      console.log("그룹 생성 응답 내용:", result)  // result 객체 내용 확인

      // result에서 groupId 추출
      const groupId = result.groupId || result.id  // 응답 구조에 맞는 key 사용
      const groupName = result.groupName || result.name // 이름 추출

      if (!groupId) {
        throw new Error("그룹 ID가 없습니다.")
      }

      // 2. 그룹 채팅방 생성 요청
      const token = localStorage.getItem("accessToken")
      if (!token) throw new Error("토큰이 없습니다.")

      const chatResponse = await fetch(
        `http://localhost:8080/api/group/${groupId}/chat/rooms`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // 토큰 확인
          },
          credentials: "include", // 세션을 포함
          body: JSON.stringify({
            name: groupName,
            description: `${groupName}의 전체 채팅방입니다.`,
            chatRoomType: "GROUP",
            participantIds: [], // 참여자 아이디 추가
          }),
        }
      )

      const chatData = await chatResponse.json()

      if (chatResponse.ok && chatData.result?.roomId) {
        showSuccess("모임 및 채팅방이 성공적으로 생성되었습니다!")
        // 그룹 생성 및 채팅방 생성 후, 채팅방 목록을 다시 로드하여 NavBar에 반영
        await loadChatRooms()  // loadChatRooms 호출
        setTimeout(() => {
          router.push(`/chat/${groupId}`)
        }, 1500)
      } else {
        throw new Error("채팅방 생성 실패")
      }
    } catch (error: any) {
      console.error("모임 생성 실패:", error)
      showError(error.response?.data?.message || "서버와 통신 중 문제가 발생했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }



  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      if (!isSubmitting) {
        handleSubmit(e as any)
      }
    }
  }

  return (
    <main className={styles.createContainer}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>새로운 벗터 만들기</h1>
        <p className={styles.pageSubtitle}>함께할 사람들과 즐거운 모임을 시작해보세요</p>
      </div>

      <form className={styles.createForm} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        {errorMessage && (
          <div
            className={errorMessage.includes("성공") ? `${styles.successMessage} ${styles.show}` : styles.errorMessage}
          >
            {errorMessage}
          </div>
        )}

        <div className={styles.formSection}>
          <div className={styles.sectionHeader}>
            <h3>기본 정보</h3>
            <p>모임의 기본 정보를 입력해주세요</p>
          </div>

          <div className={styles.mainInfo}>
            <div className={styles.coverSection}>
              <label className={styles.coverLabel}>
                <span className={styles.labelText}>커버 이미지</span>
                <div className={styles.coverUploadArea}>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverImageChange} />
                  {previewUrl ? (
                    <img
                      src={previewUrl || "/placeholder.svg"}
                      alt="커버 이미지 미리보기"
                      className={styles.coverPreview}
                    />
                  ) : (
                    <div className={styles.uploadPlaceholder}>
                      <div className={styles.uploadIcon}>📷</div>
                      <div className={styles.uploadText}>이미지 선택</div>
                      <div className={styles.uploadHint}>클릭하여 이미지를 업로드하세요</div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className={styles.nameSection}>
              <label className={styles.inputLabel}>
                <span className={styles.labelText}>모임 이름</span>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="모임 이름을 입력해주세요"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                />
              </label>
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <div className={styles.sectionHeader}>
            <h3>공개 설정</h3>
            <p>모임의 공개 범위를 선택해주세요</p>
          </div>

          <div className={styles.radioGroup}>
            <label className={styles.radioCard}>
              <input
                type="radio"
                name="access"
                value="PUBLIC"
                checked={formData.access === "PUBLIC"}
                onChange={(e) => handleInputChange("access", e.target.value)}
              />
              <div className={styles.radioContent}>
                <div className={styles.radioIcon}>🌍</div>
                <div className={styles.radioInfo}>
                  <div className={styles.radioTitle}>공개</div>
                  <div className={styles.radioDesc}>누구나 모임을 찾고 가입 요청할 수 있습니다</div>
                </div>
              </div>
            </label>
            <label className={styles.radioCard}>
              <input
                type="radio"
                name="access"
                value="PRIVATE"
                checked={formData.access === "PRIVATE"}
                onChange={(e) => handleInputChange("access", e.target.value)}
              />
              <div className={styles.radioContent}>
                <div className={styles.radioIcon}>🔒</div>
                <div className={styles.radioInfo}>
                  <div className={styles.radioTitle}>비공개</div>
                  <div className={styles.radioDesc}>초대를 통해서만 가입할 수 있습니다</div>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className={styles.formSection}>
          <div className={styles.sectionHeader}>
            <h3>모임 유형</h3>
            <p>어떤 방식으로 모임을 진행하시나요?</p>
          </div>

          <div className={styles.radioGroup}>
            <label className={styles.radioCard}>
              <input
                type="radio"
                name="type"
                value="ONLINE"
                checked={formData.type === "ONLINE"}
                onChange={(e) => handleInputChange("type", e.target.value)}
              />
              <div className={styles.radioContent}>
                <div className={styles.radioIcon}>💻</div>
                <div className={styles.radioInfo}>
                  <div className={styles.radioTitle}>온라인</div>
                  <div className={styles.radioDesc}>채팅으로 만나요</div>
                </div>
              </div>
            </label>
            <label className={styles.radioCard}>
              <input
                type="radio"
                name="type"
                value="OFFLINE"
                checked={formData.type === "OFFLINE"}
                onChange={(e) => handleInputChange("type", e.target.value)}
              />
              <div className={styles.radioContent}>
                <div className={styles.radioIcon}>🏢</div>
                <div className={styles.radioInfo}>
                  <div className={styles.radioTitle}>오프라인</div>
                  <div className={styles.radioDesc}>동네에서 만나요</div>
                </div>
              </div>
            </label>
            <label className={styles.radioCard}>
              <input
                type="radio"
                name="type"
                value="HYBRID"
                checked={formData.type === "HYBRID"}
                onChange={(e) => handleInputChange("type", e.target.value)}
              />
              <div className={styles.radioContent}>
                <div className={styles.radioIcon}>🔄</div>
                <div className={styles.radioInfo}>
                  <div className={styles.radioTitle}>온·오프라인</div>
                  <div className={styles.radioDesc}>상황에 따라 유연하게 진행해요</div>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className={styles.formSection}>
          <div className={styles.sectionHeader}>
            <h3>관심사</h3>
            <p>모임의 주요 관심사를 선택해주세요</p>
          </div>

          <div className={styles.interestGrid}>
            {[
              { value: "HOBBY", label: "취미", icon: "🎨" },
              { value: "FAMILY", label: "가족", icon: "👨‍👩‍👧‍👦" },
              { value: "SCHOOL", label: "학교", icon: "🎓" },
              { value: "BUSINESS", label: "업무", icon: "💼" },
              { value: "EXERCISE", label: "운동", icon: "💪" },
              { value: "GAME", label: "게임", icon: "🎮" },
              { value: "STUDY", label: "스터디", icon: "📚" },
              { value: "FAN", label: "팬", icon: "⭐" },
              { value: "OTHER", label: "기타", icon: "🌟" },
            ].map((interest) => (
              <label key={interest.value} className={styles.interestCard}>
                <input
                  type="radio"
                  name="interest"
                  value={interest.value}
                  checked={formData.interest === interest.value}
                  onChange={(e) => handleInputChange("interest", e.target.value)}
                />
                <div className={styles.interestContent}>
                  <div className={styles.interestIcon}>{interest.icon}</div>
                  <div className={styles.interestTitle}>{interest.label}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
          <span className={styles.btnIcon}>✨</span>
          <span className={styles.btnText}>{isSubmitting ? "생성 중..." : "모임 만들기"}</span>
        </button>
      </form>
    </main>
  )
}
