"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useGroupPermissions, usePermissionChecker } from  "@/app/components/hooks/usegrouppermissiont";
import styles from "./posts.module.css"
import api from "@/app/api"

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
  commentsNum: number
}

interface Notice {
  id: number
  content: string
  userId: number
  userName: string
  userImgUrl: string | null
  createdAt: string
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  const { isLoading: permissionsLoading } = useGroupPermissions()
  const { canCreatePost } = usePermissionChecker()

  useEffect(() => {
    if (!permissionsLoading) {
      loadNotices()
      loadPosts()
    }
  }, [groupId, permissionsLoading])

  // 공지사항 로드
  const loadNotices = async () => {
    try {
      const res = await api.get(`/groups/${groupId}/posts/notice`)
      if (res.status === 200 && res.data.result) {
        setNotices(res.data.result)
      }
    } catch (err) {
      console.error("공지사항 로드 실패:", err)
    }
  }

  // 게시글 목록 로드
  const loadPosts = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/groups/${groupId}/posts`)
      if (res.status === 200 && res.data.result) {
        setPosts(res.data.result)
      }
    } catch (err) {
      console.error("게시글 로드 실패:", err)
      setError("게시글을 불러올 수 없습니다.")
    } finally {
      setLoading(false)
    }
  }

  // HTML 콘텐츠에서 미리보기 텍스트와 썸네일 추출
  const extractPostPreviewAndThumbnail = (contentHtml: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(contentHtml, "text/html")

    // 썸네일 URL 추출 (첫 번째 이미지 또는 비디오 포스터)
    let thumbnailUrl = null
    const firstImg = doc.querySelector("img[src]")
    if (firstImg) {
      thumbnailUrl = firstImg.getAttribute("src")
    } else {
      const firstVideo = doc.querySelector("video[poster]")
      if (firstVideo) {
        thumbnailUrl = firstVideo.getAttribute("poster")
      }
    }

    // 미디어 요소 제거 후 텍스트 추출
    doc.querySelectorAll("img, video, a").forEach((el) => el.remove())
    const rawText = doc.body.textContent?.trim().replace(/\s+/g, " ") || ""
    const textPreview = rawText.slice(0, 100)
    const hasMore = rawText.length > 100

    return { thumbnailUrl, textPreview, hasMore }
  }

  // 공지사항 미리보기 텍스트 추출
  const extractNoticePreview = (contentHtml: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(contentHtml, "text/html")

    // 모든 HTML 요소 제거
    doc.querySelectorAll("img, video, a, br").forEach((el) => el.remove())
    const rawText = doc.body.textContent?.trim().replace(/\s+/g, " ") || ""
    const preview = rawText.slice(0, 30)
    const hasMore = rawText.length > 30

    return hasMore ? preview + "..." : preview
  }

  // 게시글 날짜 포맷팅
  const formatPostDate = (dateString: string) => {
    const now = new Date()
    const postDate = new Date(dateString)
    const diffMs = now.getTime() - postDate.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMinutes < 1) return "방금 전"
    if (diffMinutes < 60) return `${diffMinutes}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`

    return `${postDate.getFullYear()}년 ${postDate.getMonth() + 1}월 ${postDate.getDate()}일`
  }
  // 게시글 작성 페이지로 이동
  const goToPostCreate = () => {
    router.push(`/meeting/group/${groupId}/posts/create`)
  }

  if (loading || permissionsLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>로딩 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className={styles.postsContainer}>
      {/* 공지사항 섹션 */}
      {notices.length > 0 && (
        <div className={styles.noticeSection}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.titleIcon}>📢</span>
            공지사항
          </h2>
          <div className={styles.noticeList}>
            {notices.map((notice) => (
              <div
                key={notice.id}
                className={styles.noticeCard}
                onClick={() => router.push(`/meeting/group/${groupId}/posts/${notice.id}`)}
              >
                <div className={styles.noticeContent}>
                  <div className={styles.noticePreview}>{extractNoticePreview(notice.content)}</div>
                  <div className={styles.noticeMeta}>
                    <img
                      src={notice.userImgUrl || "/placeholder.svg?height=28&width=28"}
                      alt={notice.userName}
                      className={styles.noticeAvatar}
                    />
                    <span className={styles.noticeAuthor}>{notice.userName}</span>
                    <span className={styles.noticeDate}>{formatPostDate(notice.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 게시글 섹션 */}
      <div className={styles.postSection}>
        <div className={styles.postHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.titleIcon}>📝</span>
            게시글
          </h2>
          {canCreatePost() && (
            <button onClick={goToPostCreate} className={styles.createButton}>
              <span className={styles.buttonIcon}>✏️</span>
              게시글 작성
            </button>
          )}
        </div>

        <div className={styles.postList}>
          {posts.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📝</span>
              <p>등록된 게시글이 없습니다.</p>
            </div>
          ) : (
            posts.map((post) => {
              const { thumbnailUrl, textPreview, hasMore } = extractPostPreviewAndThumbnail(post.content)

              return (
                <div
                  key={post.id}
                  className={styles.postCard}
                  onClick={() => router.push(`/meeting/group/${groupId}/posts/${post.id}`)}
                >
                  <div className={styles.postCardContent}>
                    {thumbnailUrl && (
                      <div className={styles.postThumbnail}>
                        <img src={thumbnailUrl || "/placeholder.svg"} alt="썸네일" />
                      </div>
                    )}
                    <div className={styles.postContent}>
                      <div className={styles.postMeta}>
                        <img
                          src={post.userImgUrl || "/placeholder.svg?height=28&width=28"}
                          alt={post.userName}
                          className={styles.postAvatar}
                        />
                        <span className={styles.userName}>{post.userName}</span>
                        <span className={styles.postDate}>· {formatPostDate(post.createdAt)}</span>
                        <span className={styles.commentCount}>· 💬 {post.commentsNum}</span>
                      </div>
                      <div className={styles.postText}>
                        {textPreview}
                        {hasMore && <span className={styles.moreText}> ...더보기</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
