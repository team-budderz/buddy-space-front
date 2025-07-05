"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import styles from "../../posts.module.css"
import api from "@/app/api"
import { useGroupPermissions } from "../../../layout"

interface Post {
  id: number
  content: string
  renderedContent: string
  isNotice: boolean
  userId: number
  userName: string
  userImgUrl: string | null
  createdAt: string
  updatedAt: string
}

interface AttachedFile {
  id: number
  url: string
  type: string
  filename: string
  thumbnailUrl?: string
}

interface CurrentUser {
  id: number
  name: string
  imageUrl?: string
}

async function getAuthHeaders(): Promise<{ Authorization: string; "Content-Type": string }> {
  const token = localStorage.getItem("accessToken")
  if (!token) throw new Error("토큰이 없습니다. 로그인해주세요.")
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}


export default function EditPostPage() {
  const [post, setPost] = useState<Post | null>(null)
  const [content, setContent] = useState<string>("")
  const [isNotice, setIsNotice] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [showFileModal, setShowFileModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)

  const contentRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const params = useParams()
  const router = useRouter()
  const { id: groupId, postid } = useParams() as { id: string; postid: string }
  const postId = postid

  const { isLoading: permissionsLoading, isLeader } = useGroupPermissions()

  useEffect(() => {
    async function init() {
      await loadCurrentUser()   // ① 유저 정보 먼저
      await loadPost()          // ② 그다음 게시글 로드
    }
    init()
  }, [groupId, postId])

  useEffect(() => {
    if (post && contentRef.current) {
      contentRef.current.innerHTML = post.content
      setContent(post.content)
      setIsNotice(post.isNotice)
    }
  }, [post])


  const loadCurrentUser = async () => {
    const resp = await api.get("/users/me", { withCredentials: true })
    setCurrentUser(resp.data.result)
  }

  // loadPost: 권한 체크는 currentUser 가 null 이 아닐 때만 실행
  const loadPost = async () => {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await api.get(
        `/groups/${groupId}/posts/${postId}`,
        { headers, withCredentials: true }
      )
      const postData = res.data.result
      setPost(postData)

      // 여기서는 currentUser가 null이면 권한 체크를 잠시 건너뜀
      if (currentUser && postData.userId !== currentUser.id && !isLeader()) {
        alert("게시글 수정 권한이 없습니다.")
        router.back()
      }
    } catch (error) {
      console.error("게시글 로드 실패:", error)
      alert("게시글을 불러올 수 없습니다.")
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 50 * 1024 * 1024) {
      alert("파일 크기는 50MB 이하여야 합니다.")
      return
    }

    setSelectedFile(file)

    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => setFilePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else if (file.type.startsWith("video/")) {
      setFilePreview(URL.createObjectURL(file))
    } else {
      setFilePreview(null)
    }

    setShowFileModal(true)
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await api.post(`http://localhost:8080/api/groups/${groupId}/post-files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      const fileData = response.data.result
      setAttachedFiles((prev) => [...prev, fileData])

      addMediaToContent(fileData)

      setShowFileModal(false)
      setSelectedFile(null)
      setFilePreview(null)

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("파일 업로드 실패:", error)
      alert("파일 업로드 중 오류가 발생했습니다.")
    }
  }

  const addMediaToContent = (fileData: AttachedFile) => {
    if (!contentRef.current) return

    let mediaElement = ""

    if (fileData.type.startsWith("image/")) {
      mediaElement = `<div class="preview-media"><img data-id="${fileData.id}" src="${fileData.url}" alt="첨부 이미지" /><button type="button" class="delete-btn" onclick="removeMediaElement(this)">삭제</button></div>`
    } else if (fileData.type.startsWith("video/")) {
      const poster = fileData.thumbnailUrl ? `poster="${fileData.thumbnailUrl}"` : ""
      mediaElement = `<div class="preview-media"><video data-id="${fileData.id}" controls ${poster}><source src="${fileData.url}" type="${fileData.type}" /></video><button type="button" class="delete-btn" onclick="removeMediaElement(this)">삭제</button></div>`
    } else {
      mediaElement = `<div class="preview-media"><a data-id="${fileData.id}" href="${fileData.url}" target="_blank" class="file-link"><span class="file-icon">📎</span><span class="file-name">${fileData.filename}</span></a><button type="button" class="delete-btn" onclick="removeMediaElement(this)">삭제</button></div>`
    }

    contentRef.current.innerHTML += mediaElement
    setContent(contentRef.current.innerHTML)
  }

  const handleSubmit = async () => {
    // 1) content 유효성 검사
    const text = typeof content === "string" ? content.trim() : ""
    if (!text && attachedFiles.length === 0) {
      alert("게시글 내용을 입력해주세요.")
      return
    }

    try {
      setIsSubmitting(true)

      // 2) 로컬스토리지에서 토큰 헤더 준비
      const headers = await getAuthHeaders()
      console.log("PATCH headers:", headers)

      // 3) 불필요한 HTML(삭제 버튼) 제거
      const cleanedContent = content.replace(
        /<button[^>]*class="delete-btn"[^>]*>.*?<\/button>/g,
        ""
      )

      // 4) PATCH 요청으로 수정
      await api.patch(
        `/groups/${groupId}/posts/${postId}`,
        { content: cleanedContent, isNotice },
        { headers, withCredentials: true }
      )

      alert("게시글이 수정되었습니다!")
      router.push(`/meeting/group/${groupId}/posts/${postId}`)
    } catch (err: any) {
      console.error("게시글 수정 실패:", err)
      if (err.response?.status === 401) {
        alert("인증이 만료되었습니다. 다시 로그인해주세요.")
        router.push("/login")
      } else if (err.response?.status === 403) {
        alert("수정 권한이 없습니다.")
      } else {
        alert("게시글 수정 중 오류가 발생했습니다.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }







  const handleCancel = () => {
    if (confirm("수정을 취소하시겠습니까?")) {
      router.back()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  if (loading || permissionsLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>로딩 중...</p>
      </div>
    )
  }

  if (!post) {
    return <div className={styles.errorContainer}>게시글을 찾을 수 없습니다.</div>
  }

  return (
    <div className={styles.createContainer}>
      <div className={styles.createCard}>
        <div className={styles.createHeader}>
          <div className={styles.headerTop}>
            <button onClick={handleCancel} className={styles.backButton}>
              <span className={styles.buttonIcon}>←</span>
              뒤로가기
            </button>
            <h1 className={styles.createTitle}>게시글 수정</h1>
          </div>
        </div>

        <div className={styles.createContent}>
          <div className={styles.editorSection}>
            <div className={styles.toolbar}>
              <button onClick={() => fileInputRef.current?.click()} className={styles.toolbarButton}>
                <span className={styles.buttonIcon}>📎</span>
                파일 첨부
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className={styles.hiddenInput}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              />
            </div>

            <div
              ref={contentRef}
              contentEditable
              className={styles.contentEditor}
              onInput={(e) => setContent(e.currentTarget.innerHTML)}
              data-placeholder="게시글 내용을 입력하세요..."
            />
          </div>

          <div className={styles.optionsSection}>
            <div className={styles.checkboxGroup}>
              <input
                type="checkbox"
                id="notice"
                checked={isNotice}
                onChange={(e) => setIsNotice(e.target.checked)}
                className={styles.checkbox}
              />
              <label htmlFor="notice" className={styles.checkboxLabel}>
                공지사항으로 등록
              </label>
            </div>
          </div>

          <div className={styles.actionButtons}>
            <button onClick={handleCancel} disabled={isSubmitting} className={styles.cancelButton}>
              취소
            </button>
            <button onClick={handleSubmit} disabled={isSubmitting} className={styles.submitButton}>
              {isSubmitting ? (
                "수정 중..."
              ) : (
                <>
                  <span className={styles.buttonIcon}>✓</span>
                  수정 완료
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showFileModal && (
        <div className={styles.modalOverlay} onClick={() => setShowFileModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>파일 첨부</h3>
              <button onClick={() => setShowFileModal(false)} className={styles.modalCloseButton}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {filePreview && (
                <div className={styles.filePreview}>
                  {selectedFile?.type.startsWith("image/") ? (
                    <img src={filePreview || "/placeholder.svg"} alt="미리보기" />
                  ) : selectedFile?.type.startsWith("video/") ? (
                    <video src={filePreview} controls />
                  ) : (
                    <div className={styles.fileInfo}>
                      <div className={styles.fileIcon}>📄</div>
                      <div className={styles.fileName}>{selectedFile?.name}</div>
                      <div className={styles.fileSize}>{selectedFile && formatFileSize(selectedFile.size)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button onClick={() => setShowFileModal(false)} className={styles.modalCancelButton}>
                취소
              </button>
              <button onClick={handleFileUpload} className={styles.modalConfirmButton}>
                첨부
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
