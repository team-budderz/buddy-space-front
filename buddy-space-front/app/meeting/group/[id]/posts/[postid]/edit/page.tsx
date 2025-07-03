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

export default function EditPostPage() {
  const [post, setPost] = useState<Post | null>(null)
  const [content, setContent] = useState("")
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
  const groupId = params.id as string
  const postId = params.postId as string

  const { isLoading: permissionsLoading, isLeader } = useGroupPermissions()

  useEffect(() => {
    loadCurrentUser()
    loadPost()
  }, [groupId, postId])

  useEffect(() => {
    if (post && contentRef.current) {
      contentRef.current.innerHTML = post.content
      setContent(post.content)
      setIsNotice(post.isNotice)
    }
  }, [post])

  const loadCurrentUser = async () => {
    try {
      const response = await api.get("/users/me")
      setCurrentUser(response.data.result)
    } catch (error) {
      console.error("사용자 정보 로드 실패:", error)
    }
  }

  const loadPost = async () => {
    try {
      setLoading(true)
      const response = await api.get(`http://localhost:8080/api/groups/${groupId}/posts/${postId}`)
      const postData = response.data.result
      setPost(postData)

      // 권한 체크
      if (!currentUser || (postData.userId !== currentUser.id && !isLeader())) {
        alert("게시글 수정 권한이 없습니다.")
        router.back()
        return
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
    if (!content.trim() && attachedFiles.length === 0) {
      alert("게시글 내용을 입력해주세요.")
      return
    }

    try {
      setIsSubmitting(true)

      const cleanedContent = content.replace(/<button[^>]*class="delete-btn"[^>]*>.*?<\/button>/g, "")

      const postData = {
        content: cleanedContent,
        isNotice,
      }

      await api.put(`http://localhost:8080/api/groups/${groupId}/posts/${postId}`, postData)

      alert("게시글이 수정되었습니다!")
      router.push(`/meeting/group/${groupId}/posts/${postId}`)
    } catch (error) {
      console.error("게시글 수정 실패:", error)
      alert("게시글 수정 중 오류가 발생했습니다.")
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
