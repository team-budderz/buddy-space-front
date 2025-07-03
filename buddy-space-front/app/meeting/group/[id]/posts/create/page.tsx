"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import styles from "../posts.module.css"
import api from "@/app/api"
import { useGroupPermissions } from "../../layout"

interface AttachedFile {
  id: number
  url: string
  type: string
  filename: string
  thumbnailUrl?: string
}

export default function CreatePostPage() {
  const [content, setContent] = useState("")
  const [isNotice, setIsNotice] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showFileModal, setShowFileModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)

  const contentRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  async function getAuthHeaders(): Promise<{ Authorization: string; "Content-Type": string }> {
    const token = localStorage.getItem("accessToken")
    if (!token) throw new Error("토큰이 없습니다. 로그인해주세요.")
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  }
  const { isLoading: permissionsLoading, isMemberOrAbove } = useGroupPermissions()


  useEffect(() => {
    if (!permissionsLoading && !isMemberOrAbove()) {
      alert("게시글 작성 권한이 없습니다.")
      router.back()
    }
  }, [permissionsLoading, isMemberOrAbove, router])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (content.trim() || attachedFiles.length > 0) {
        e.preventDefault()
        e.returnValue = "작성 중인 내용이 있습니다. 정말 나가시겠습니까?"
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [content, attachedFiles])

  useEffect(() => {
    ; (window as any).removeMediaElement = (button: HTMLButtonElement) => {
      const mediaContainer = button.closest(".preview-media")
      if (mediaContainer) {
        const mediaElement = mediaContainer.querySelector("[data-id]")
        if (mediaElement) {
          const fileId = Number.parseInt(mediaElement.getAttribute("data-id") || "0")
          removeMediaElement(fileId)
        }
      }
    }

    return () => {
      delete (window as any).removeMediaElement
    }
  }, [])

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

      const response = await api.post(`/groups/${groupId}/post-files`, formData, {
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

  const addMediaToContent = (fileData: { id: number; url: string; type: string; filename: string; thumbnailUrl?: string }) => {
    if (!contentRef.current) return

    let mediaElement = ''
    const baseDiv = `<div class="preview-media" contentEditable="false" style="position: relative; display: inline-block; margin: 8px;">`
    const closeDiv = `</div>`
    const deleteButton = `<button type="button" class="delete-btn" contentEditable="false" onclick="removeMediaElement(this)" style="position: absolute; top: 8px; right: 8px; background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">삭제</button>`

    if (fileData.type.startsWith('image/')) {
      mediaElement =
        baseDiv +
        `<img data-id="${fileData.id}" src="${fileData.url}" alt="첨부 이미지" contentEditable="false" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0;" />` +
        deleteButton +
        closeDiv
    } else if (fileData.type.startsWith('video/')) {
      const posterAttr = fileData.thumbnailUrl ? `poster="${fileData.thumbnailUrl}"` : ''
      mediaElement =
        baseDiv +
        `<video data-id="${fileData.id}" controls ${posterAttr} contentEditable="false" style="max-width: 100%; height: auto; border-radius: 8px;"><source src="${fileData.url}" type="${fileData.type}" /></video>` +
        deleteButton +
        closeDiv
    } else {
      mediaElement =
        baseDiv +
        `<a data-id="${fileData.id}" href="${fileData.url}" target="_blank" class="file-link" contentEditable="false" style="display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-decoration: none; color: #374151;"><span class="file-icon" contentEditable="false">📎</span><span class="file-name" contentEditable="false">${fileData.filename}</span></a>` +
        deleteButton +
        closeDiv
    }

    contentRef.current.innerHTML += mediaElement
    setContent(contentRef.current.innerHTML)
  }

  const removeMediaElement = async (fileId: number) => {
    try {
      const headers = await getAuthHeaders()

      await api.delete('/attachments', {
        headers,
        data: [fileId],  
      })

      setAttachedFiles(prev => prev.filter(f => f.id !== fileId))
      if (contentRef.current) {
        const mediaEl = contentRef.current
          .querySelector(`[data-id=\"${fileId}\"]`)
          ?.closest('.preview-media')
        if (mediaEl) {
          mediaEl.remove()
          setContent(contentRef.current.innerHTML)
        }
      }
    } catch (error: any) {
      console.error('파일 삭제 실패:', error)
      if (error.response?.status === 401) {
        alert('인증이 만료되었습니다. 다시 로그인해주세요.')
        router.push('/login')
      } else if (error.response?.status === 403) {
        alert('권한이 없습니다. 해당 파일을 삭제할 수 없습니다.')
      } else if (error.response?.status === 404) {
        alert('파일을 찾을 수 없습니다.')
      } else {
        alert('파일 삭제 중 오류가 발생했습니다.')
      }
    }
  }



  const handleSubmit = async () => {
    if (!content.trim() && attachedFiles.length === 0) {
      alert('게시글 내용을 입력해주세요.')
      return
    }
    try {
      setIsSubmitting(true)
      const cleaned = content.replace(/<button[^>]*>.*?<\/button>/g, '')
      const postData = { content: cleaned, isNotice: false, reserveAt: null }
      const headers = await getAuthHeaders()
      const res = await api.post(`/groups/${groupId}/posts`, postData, { headers })
      const postId = res.data.result.postId
      router.push(`/meeting/group/${groupId}/posts/${postId}`)
    } catch (err) {
      console.error('게시글 작성 실패', err)
      alert('게시글 작성 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (content.trim() || attachedFiles.length > 0) {
      if (!confirm("작성 중인 내용이 있습니다. 정말 나가시겠습니까?")) {
        return
      }
    }

    if (attachedFiles.length > 0) {
      try {
        await Promise.all(attachedFiles.map((file) => api.delete(`/groups/${groupId}/post-files/${file.id}`)))
      } catch (error) {
        console.warn("첨부파일 정리 실패:", error)
      }
    }

    router.back()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  if (permissionsLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>로딩 중...</p>
      </div>
    )
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
            <h1 className={styles.createTitle}>게시글 작성</h1>
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
                "작성 중..."
              ) : (
                <>
                  <span className={styles.buttonIcon}>✓</span>
                  작성 완료
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
