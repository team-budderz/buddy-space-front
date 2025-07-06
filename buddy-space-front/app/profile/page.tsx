"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import styles from "./profile.module.css"
import api from "@/app/api"

interface UserInfo {
  name: string
  email: string
  birthDate?: string
  gender?: "M" | "F"
  phone?: string
  address?: string
  profileImageUrl?: string
  profileAttachmentId?: string
  provider: "LOCAL" | "GOOGLE"
  hasNeighborhood: boolean
}

interface ToastState {
  show: boolean
  message: string
  type: "success" | "error" | "warning" | "info"
}

export default function ProfilePage() {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageAction, setImageAction] = useState<"keep" | "change" | "remove">("keep")
  const [isPasswordVerified, setIsPasswordVerified] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" })
  const [verifiedPassword, setVerifiedPassword] = useState<string>("")

  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPasswordAuthModal, setShowPasswordAuthModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<string>("")

  const [editAddress, setEditAddress] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [imagePreview, setImagePreview] = useState<string>("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchUserInfo()

    // Daum 주소 API 스크립트 로드
    const script = document.createElement("script")
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
    script.async = true
    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  useEffect(() => {
    if (userInfo) {
      setEditAddress(userInfo.address || "")
      setEditPhone(userInfo.phone || "")
    }
  }, [userInfo])

  const fetchUserInfo = async () => {
    try {
      setIsLoading(true)
      const response = await api.get("/users/me")
      setUserInfo(response.data.result)
    } catch (error) {
      console.error("사용자 정보 조회 실패:", error)
      showToast("사용자 정보를 불러올 수 없습니다.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (message: string, type: ToastState["type"] = "success") => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }))
    }, 5000)
  }

  const toggleEdit = () => {
    if (isEditing) {
      setEditAddress(userInfo?.address || "")
      setEditPhone(userInfo?.phone || "")
      resetImageSelection()
    }
    setIsEditing(!isEditing)
  }

  const resetImageSelection = () => {
    setSelectedFile(null)
    setImageAction("keep")
    setImagePreview("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("파일 크기는 5MB 이하여야 합니다.", "error")
        e.target.value = ""
        return
      }

      if (!file.type.startsWith("image/")) {
        showToast("이미지 파일만 업로드 가능합니다.", "error")
        e.target.value = ""
        return
      }

      setSelectedFile(file)
      setImageAction("change")

      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeProfileImage = () => {
    setSelectedFile(null)
    setImageAction("remove")
    setImagePreview("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const formatPhoneInput = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "")
    if (cleaned.length <= 3) {
      return cleaned
    } else if (cleaned.length <= 7) {
      return cleaned.replace(/(\d{3})(\d{1,4})/, "$1-$2")
    } else {
      return cleaned.replace(/(\d{3})(\d{4})(\d{1,4})/, "$1-$2-$3")
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value)
    setEditPhone(formatted)
  }

  const handleAddressSearch = () => {
    if (typeof window !== "undefined" && (window as any).daum?.Postcode) {
      ; new (window as any).daum.Postcode({
        oncomplete: (data: any) => {
          const jibunAddress = data.jibunAddress
          const { sido, sigungu, bname } = data
          const selectedAddress = jibunAddress || `${sido} ${sigungu} ${bname}`
          setEditAddress(selectedAddress)
        },
      }).open()
    } else {
      showToast("주소 검색 서비스를 불러올 수 없습니다.", "error")
    }
  }

  const saveUserInfo = async (skipVerify = false) => {
    if (!skipVerify && !isPasswordVerified) {
      setPendingAction("save");
      setShowPasswordAuthModal(true);
      return;
    }

    try {
      setIsLoading(true);

      const form = new FormData();
      const reqData = {
        address: editAddress || null,
        phone: editPhone || null,
        profileAttachmentId: userInfo?.profileAttachmentId ?? null,
      };
      form.append(
        "request",
        new Blob([JSON.stringify(reqData)], {
          type: "application/json",
        })
      );
      if (imageAction === "change" && selectedFile) {
        form.append("profileImage", selectedFile);
      }

      await api.patch("/users", form);

      showToast("정보가 성공적으로 업데이트되었습니다.", "success");
      setIsEditing(false);
      setIsPasswordVerified(false);
      setImageAction("keep");
      setSelectedFile(null);
      setImagePreview("");
      await fetchUserInfo();
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        showToast("비밀번호 인증이 필요합니다.", "error");
        setPendingAction("save");
        setShowPasswordAuthModal(true);
      } else {
        showToast(error.response?.data?.message || "업데이트에 실패했습니다.", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };


  const updatePassword = async (skipVerify = false) => {
    if (!skipVerify && !isPasswordVerified) {
      setPendingAction("password");
      setShowPasswordAuthModal(true);
      return;
    }
    if (!newPassword) {
      showToast("새 비밀번호를 입력해주세요.", "error");
      return;
    }
    try {
      await api.patch("/users/password", { password: newPassword });
      showToast("비밀번호가 성공적으로 변경되었습니다.", "success");
      setShowPasswordModal(false);
      setNewPassword("");
      setIsPasswordVerified(false);
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        showToast("비밀번호 인증이 필요합니다.", "error");
        setPendingAction("password");
        setShowPasswordAuthModal(true);
      } else {
        showToast(error.response?.data?.message || "비밀번호 변경에 실패했습니다.", "error");
      }
    }
  };


  const deleteAccount = async (skipVerify = false) => {
    if (!skipVerify && !isPasswordVerified) {
      setPendingAction("delete")
      setShowPasswordModal(false)
      setShowPasswordAuthModal(true)
      return
    }

    try {
      await api.delete("/users", { withCredentials: true })

      showToast("그동안 이용해주셔서 감사합니다.")
      localStorage.removeItem("accessToken")
      setTimeout(() => {
        router.push("/login")
      }, 2000)

    } catch (error: any) {
      console.error("회원 탈퇴 실패:", error)
      const errorMessage = error.response?.data?.message || "회원 탈퇴에 실패했습니다."
      showToast(errorMessage, "error")
    }
  }

  const authenticatePassword = async () => {
    if (!authPassword) {
      showToast("비밀번호를 입력해주세요.", "error")
      return
    }

    try {
      await api.post("/users/verify-password", { password: authPassword })

      setIsPasswordVerified(true)
      setVerifiedPassword(authPassword)
      setShowPasswordAuthModal(false)
      setAuthPassword("")

      // 인증 성공 후 원래 작업 실행
      console.log("[기존 작업] pendingAction", pendingAction);

      if (pendingAction === "save") {
        await saveUserInfo(true)
      } else if (pendingAction === "password") {
        await updatePassword(true)
      } else if (pendingAction === "delete") {
        await deleteAccount(true)
      }

      setPendingAction("")

    } catch (error: any) {
      console.error("비밀번호 인증 실패:", error)
      const errorMessage = error.response?.data?.message || "비밀번호 인증에 실패했습니다."
      showToast(errorMessage, "error")
    }
  }

  const handleNeighborhoodAuth = async () => {
    if (!navigator.geolocation) {
      showToast("이 브라우저는 위치 정보 API를 지원하지 않습니다.", "error")
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        try {
          const response = await api.post("/neighborhoods", {
            latitude,
            longitude,
          })

          const neighborhood = response.data.result
          showToast(`동네 인증 완료: ${neighborhood.address}`)
          await fetchUserInfo()
        } catch (error: any) {
          console.error("동네 인증 실패:", error)
          const errorMessage = error.response?.data?.message || "동네 인증에 실패했습니다."
          showToast(errorMessage, "error")
        }
      },
      (error) => {
        let errorMessage = "위치 정보를 가져올 수 없습니다."
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요."
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = "위치 정보를 사용할 수 없습니다."
            break
          case error.TIMEOUT:
            errorMessage = "위치 정보 요청 시간이 초과되었습니다."
            break
        }
        showToast(errorMessage, "error")
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    )
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "미등록"
    return new Date(dateString).toLocaleDateString("ko-KR")
  }

  const formatPhone = (phone?: string) => {
    if (!phone) return ""
    return phone.replace(/(\d{2,3})(\d{3,4})(\d{4})/, "$1-$2-$3")
  }

  const getGenderText = (gender?: string) => {
    const genderMap = { M: "남성", F: "여성" }
    return genderMap[gender as keyof typeof genderMap] || "알 수 없음"
  }

  const getProviderInfo = (provider: string) => {
    const providers = {
      LOCAL: { text: "일반", class: "" },
      GOOGLE: { text: "구글", class: "google" },
    }
    return providers[provider as keyof typeof providers] || providers.LOCAL
  }

  if (isLoading) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>사용자 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!userInfo) {
    return (
      <div className={styles.profileContainer}>
        <div className={styles.loadingContainer}>
          <p>사용자 정보를 불러올 수 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.profileContainer}>
      <div className={styles.profileLayout}>
        <div className={styles.sidebar}>
          <div className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <div className={styles.profileAvatar}>
                {userInfo.profileImageUrl ? (
                  <img src={userInfo.profileImageUrl || "/placeholder.svg"} alt={userInfo.name} />
                ) : (
                  <div className={styles.avatarFallback}>{userInfo.name.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <h2>{userInfo.name}</h2>
              <p>{userInfo.email}</p>
            </div>
            <div className={styles.sidebarNav}>
              <button
                className={`${styles.navItem} ${activeTab === "profile" ? styles.active : ""}`}
                onClick={() => setActiveTab("profile")}
              >
                <span className={styles.navIcon}>👤</span>
                프로필 관리
              </button>
              <button
                className={`${styles.navItem} ${activeTab === "requests" ? styles.active : ""}`}
                onClick={() => router.push("/requested")}
              >
                <span className={styles.navIcon}>👥</span>
                가입 요청 관리
              </button>
            </div>
          </div>
        </div>

        <div className={styles.mainContent}>
          <div className={styles.infoCard}>
            <div className={styles.cardHeader}>
              <div className={styles.headerLeft}>
                <h3>
                  <span className={styles.cardIcon}>👤</span>
                  기본 정보
                </h3>
              </div>
              <p className={styles.cardDescription}>회원가입 시 등록한 기본 정보입니다.</p>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <label>이름</label>
                  <p>{userInfo.name}</p>
                </div>
                <div className={styles.infoItem}>
                  <label>이메일</label>
                  <p>{userInfo.email}</p>
                </div>
                <div className={styles.infoItem}>
                  <label>생년월일</label>
                  <p>{formatDate(userInfo.birthDate)}</p>
                </div>
                <div className={styles.infoItem}>
                  <label>성별</label>
                  <p>{getGenderText(userInfo.gender)}</p>
                </div>
                <div className={styles.infoItem}>
                  <label>가입 방식</label>
                  <span className={`${styles.providerBadge} ${getProviderInfo(userInfo.provider).class}`}>
                    {getProviderInfo(userInfo.provider).text}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.cardHeader}>
              <div className={styles.headerLeft}>
                <h3>
                  <span className={styles.cardIcon}>👤</span>
                  개인 정보
                </h3>
                <p className={styles.cardDescription}>연락처 및 프로필 이미지를 관리할 수 있습니다.</p>
              </div>
              <button
                className={`${styles.btn} ${isEditing ? styles.btnSecondary : styles.btnPrimary}`}
                onClick={toggleEdit}
              >
                {isEditing ? "취소" : "수정"}
              </button>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.profileImageSection}>
                <div className={`${styles.profileAvatar} ${styles.large}`}>
                  {userInfo.profileImageUrl ? (
                    <img src={userInfo.profileImageUrl || "/placeholder.svg"} alt={userInfo.name} />
                  ) : (
                    <div className={`${styles.avatarFallback} ${styles.large}`}>
                      {userInfo.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {isEditing && (
                  <div className={styles.imageUpload}>
                    <div className={styles.imageControls}>
                      <label className={styles.uploadBtn}>
                        <span className={styles.uploadIcon}>📷</span>
                        이미지 선택
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          style={{ display: "none" }}
                        />
                      </label>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
                        onClick={removeProfileImage}
                      >
                        제거
                      </button>
                    </div>
                    {imagePreview && (
                      <div className={styles.imagePreview}>
                        <img src={imagePreview || "/placeholder.svg"} alt="미리보기" />
                        <p className={styles.previewText}>새 프로필 이미지 미리보기</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.separator}></div>

              <div className={styles.infoItem}>
                <label>전화번호</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editPhone}
                    onChange={handlePhoneChange}
                    placeholder="전화번호를 입력하세요"
                    className={styles.editInput}
                  />
                ) : (
                  <p>{formatPhone(userInfo.phone) || "미등록"}</p>
                )}
              </div>

              <div className={styles.infoItem}>
                <label>주소</label>
                {isEditing ? (
                  <div className={styles.addressInputGroup}>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="주소를 입력하세요"
                      className={styles.editInput}
                    />
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnOutline}`}
                      onClick={handleAddressSearch}
                    >
                      주소 검색
                    </button>
                  </div>
                ) : (
                  <div className={styles.neighborhoodDisplayLine}>
                    <div className={styles.neighborhoodInfo}>
                      <span className={styles.neighborhoodAddress}>{userInfo.address || "미등록"}</span>
                      <span
                        className={`${styles.neighborhoodStatusBadge} ${userInfo.hasNeighborhood ? styles.verified : styles.unverified
                          }`}
                      >
                        {userInfo.hasNeighborhood ? "인증완료" : "미인증"}
                      </span>
                    </div>
                    <button
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                      onClick={handleNeighborhoodAuth}
                    >
                      {userInfo.hasNeighborhood ? "🔄 동네 재인증" : "📍 동네 인증하기"}
                    </button>
                  </div>
                )}
              </div>

              {isEditing && (
                <div className={styles.saveButtons}>
                  <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => saveUserInfo()}>
                    저장
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.cardHeader}>
              <div className={styles.headerLeft}>
                <h3>
                  <span className={styles.cardIcon}>🔒</span>
                  보안 설정
                </h3>
                <p className={styles.cardDescription}>비밀번호 변경 및 계정 관리를 할 수 있습니다.</p>
              </div>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.securityItem}>
                <div className={styles.securityInfo}>
                  <h4>비밀번호 변경</h4>
                  <p>정기적인 비밀번호 변경으로 계정을 안전하게 보호하세요.</p>
                </div>
                <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setShowPasswordModal(true)}>
                  비밀번호 변경
                </button>
              </div>
              <div className={styles.separator}></div>
              <div className={styles.securityItem}>
                <div className={styles.securityInfo}>
                  <h4 className={styles.danger}>회원 탈퇴</h4>
                  <p>계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.</p>
                </div>
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setShowDeleteModal(true)}>
                  회원 탈퇴
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>비밀번호 변경</h3>
              <button className={styles.modalClose} onClick={() => setShowPasswordModal(false)}>
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDescription}>새로운 비밀번호를 입력해주세요.</p>
              <div className={styles.formGroup}>
                <label>새 비밀번호</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.formInput}
                  placeholder="새 비밀번호를 입력하세요"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updatePassword()
                    }
                  }}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowPasswordModal(false)}>
                취소
              </button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => updatePassword()}>
                변경
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>회원 탈퇴</h3>
              <button className={styles.modalClose} onClick={() => setShowDeleteModal(false)}>
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDescription}>정말로 회원 탈퇴를 하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowDeleteModal(false)}>
                취소
              </button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => deleteAccount()}>
                탈퇴하기
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordAuthModal && (
        <div className={`${styles.modal} ${styles.authModal}`}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>비밀번호 확인</h3>
              <button className={styles.modalClose} onClick={() => setShowPasswordAuthModal(false)}>
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.authDescription}>
                <h4>보안을 위해 비밀번호를 다시 입력해주세요</h4>
                <p>민감한 정보 변경을 위해 본인 확인이 필요합니다.</p>
              </div>
              <div className={styles.formGroup}>
                <label>현재 비밀번호</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className={styles.formInput}
                  placeholder="현재 비밀번호를 입력하세요"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      authenticatePassword()
                    }
                  }}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowPasswordAuthModal(false)}
              >
                취소
              </button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={authenticatePassword}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && <div className={`${styles.toast} ${styles[toast.type]} ${styles.show}`}>{toast.message}</div>}
    </div>
  )
}
