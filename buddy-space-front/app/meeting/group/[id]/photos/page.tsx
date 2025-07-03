"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation";
import styles from "./photos.module.css"

interface Attachment {
  id: string
  filename: string
  type: string
  size: number
  url: string
  thumbnailUrl?: string
  uploadedAt: string
}

type Category = "all" | "image" | "video"

const CATEGORY_TITLES = {
  all: "전체 미디어",
  image: "사진",
  video: "영상",
}

export default function PhotosPage() {
  const [allAttachments, setAllAttachments] = useState<Attachment[]>([])
  const [currentCategory, setCurrentCategory] = useState<Category>("all")
  const [currentAttachment, setCurrentAttachment] = useState<Attachment | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadState, setDownloadState] = useState<{
    isDownloading: boolean
    text: string
  }>({ isDownloading: false, text: "📥 다운로드" })

  const { id: groupId } = useParams()

  const fetchWithAuth = async (url: string) => {
    const token = localStorage.getItem("accessToken")
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
    return response
  }

  const loadAlbumData = useCallback(async () => {
    if (!groupId) {
      setError("그룹 ID가 없습니다.")
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const url = `http://localhost:8080/api/groups/${groupId}/albums`
      const response = await fetchWithAuth(url)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (data.result) {
        setAllAttachments(data.result)
      } else {
        throw new Error("데이터 형식이 올바르지 않습니다.")
      }
    } catch (err) {
      console.error("앨범 데이터 로드 실패:", err)
      setError("사진을 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    loadAlbumData()
  }, [loadAlbumData])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        closeModal()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isModalOpen])

  const getFilteredAttachments = () => {
    switch (currentCategory) {
      case "image":
        return allAttachments.filter((a) => a.type.startsWith("image/"))
      case "video":
        return allAttachments.filter((a) => a.type.startsWith("video/"))
      default:
        return allAttachments
    }
  }

  const getCounts = () => ({
    all: allAttachments.length,
    image: allAttachments.filter((a) => a.type.startsWith("image/")).length,
    video: allAttachments.filter((a) => a.type.startsWith("video/")).length,
  })

  const openModal = (attachment: Attachment) => {
    setCurrentAttachment(attachment)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setCurrentAttachment(null)
    setDownloadState({ isDownloading: false, text: "📥 다운로드" })

    const video = document.querySelector(`.${styles.modalMediaContainer} video`) as HTMLVideoElement
    if (video) {
      video.pause()
      video.currentTime = 0
    }
  }

  const handleDownload = async () => {
    if (!currentAttachment) return

    try {
      setDownloadState({ isDownloading: true, text: "⏳ 준비 중..." })

      const response = await fetchWithAuth(`http://localhost:8080/api/attachments/${currentAttachment.id}/download`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.result) {
        const link = document.createElement("a")
        link.href = data.result
        link.download = currentAttachment.filename
        link.style.display = "none"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        setDownloadState({ isDownloading: true, text: "✅ 완료" })
        setTimeout(() => {
          setDownloadState({ isDownloading: false, text: "📥 다운로드" })
        }, 2000)
      } else {
        throw new Error("다운로드 URL을 받을 수 없습니다.")
      }
    } catch (error) {
      console.error("다운로드 실패:", error)
      alert("다운로드에 실패했습니다. 다시 시도해주세요.")
      setDownloadState({ isDownloading: false, text: "📥 다운로드" })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}.${month}.${day}`
  }

  const filteredAttachments = getFilteredAttachments()
  const counts = getCounts()

  return (
    <main>
      <section className={styles.groupContent}>
        <div className={styles.photoAlbumContainer}>
          <div className={styles.photoSidebar}>
            <ul className={styles.photoMenuList}>
              {(["all", "image", "video"] as Category[]).map((category) => (
                <li key={category} className={styles.photoMenuItem}>
                  <button
                    className={`${styles.photoMenuLink} ${currentCategory === category ? styles.active : ""}`}
                    onClick={() => setCurrentCategory(category)}
                  >
                    <span className={styles.photoMenuIcon}>
                      {category === "all" ? "🗂️" : category === "image" ? "📷" : "🎬"}
                    </span>
                    {category === "all" ? "전체" : category === "image" ? "사진" : "영상"}
                    <span className={styles.photoMenuCount}>{counts[category]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.photoMainContent}>
            <div className={styles.photoHeader}>
              <h4>{CATEGORY_TITLES[currentCategory]}</h4>
            </div>

            <div className={styles.photoGrid}>
              {isLoading ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.loadingSpinner}></div>
                  <div className={styles.loadingText}>사진을 불러오는 중...</div>
                </div>
              ) : error ? (
                <div className={styles.errorState}>
                  <div className={styles.errorStateIcon}>⚠️</div>
                  <h5>오류가 발생했습니다</h5>
                  <p>{error}</p>
                  <button className={styles.retryBtn} onClick={loadAlbumData}>
                    다시 시도
                  </button>
                </div>
              ) : filteredAttachments.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon}>📷</div>
                  <p>등록된 파일이 없습니다.</p>
                </div>
              ) : (
                filteredAttachments.map((attachment) => {
                  const isVideo = attachment.type.startsWith("video/")
                  const imageUrl = isVideo && attachment.thumbnailUrl ? attachment.thumbnailUrl : attachment.url

                  return (
                    <div key={attachment.id} className={styles.photoItem} onClick={() => openModal(attachment)}>
                      <img src={imageUrl || "/placeholder.svg"} alt={attachment.filename} loading="lazy" />
                      {isVideo && (
                        <>
                          <div className={styles.videoIndicator}>🎬 영상</div>
                          <button className={styles.videoPlayBtn}>▶</button>
                        </>
                      )}
                      <div className={styles.photoOverlay}>
                        <div className={styles.photoInfo}>
                          <div>{attachment.filename}</div>
                          <div className={styles.photoDate}>{formatDate(attachment.uploadedAt)}</div>
                          <div className={styles.photoSize}>{formatFileSize(attachment.size)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {isModalOpen && currentAttachment && (
        <div
          className={`${styles.mediaModal} ${isModalOpen ? styles.active : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal()
            }
          }}
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{currentAttachment.filename}</h3>
              <div className={styles.modalActions}>
                <button
                  className={`${styles.modalBtn} ${styles.downloadBtn}`}
                  onClick={handleDownload}
                  disabled={downloadState.isDownloading}
                >
                  {downloadState.text}
                </button>
                <button className={`${styles.modalBtn} ${styles.closeBtn}`} onClick={closeModal}>
                  ✕ 닫기
                </button>
              </div>
            </div>

            <div className={styles.modalMediaContainer}>
              {currentAttachment.type.startsWith("video/") ? (
                <video
                  src={currentAttachment.url}
                  controls
                  autoPlay={false}
                  preload="metadata"
                  onError={() => {
                    console.error("비디오 로드 실패")
                  }}
                />
              ) : (
                <img
                  src={currentAttachment.url || "/placeholder.svg"}
                  alt={currentAttachment.filename}
                  onError={() => {
                    console.error("이미지 로드 실패")
                  }}
                />
              )}
            </div>

            <div className={styles.modalInfo}>
              <div className={styles.modalInfoGrid}>
                <div className={styles.modalInfoItem}>
                  <div className={styles.modalInfoLabel}>파일명</div>
                  <div className={styles.modalInfoValue}>{currentAttachment.filename}</div>
                </div>
                <div className={styles.modalInfoItem}>
                  <div className={styles.modalInfoLabel}>타입</div>
                  <div className={styles.modalInfoValue}>
                    {currentAttachment.type.startsWith("video/") ? "영상" : "사진"}
                  </div>
                </div>
                <div className={styles.modalInfoItem}>
                  <div className={styles.modalInfoLabel}>크기</div>
                  <div className={styles.modalInfoValue}>{formatFileSize(currentAttachment.size)}</div>
                </div>
                <div className={styles.modalInfoItem}>
                  <div className={styles.modalInfoLabel}>업로드 날짜</div>
                  <div className={styles.modalInfoValue}>{formatDate(currentAttachment.uploadedAt)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
