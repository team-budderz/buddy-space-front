"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useGroupPermissions } from "../../layout"
import styles from "../posts.module.css"
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
  comments: Comment[]
  commentNum: number
}

interface Comment {
  commentId: number
  content: string
  userId: number
  userName: string
  userImgUrl: string | null
  createdAt: string
  commentNum: number
  replies?: Reply[]
}

interface Reply {
  id: number
  content: string
  userId: number
  userName: string
  userImgUrl: string | null
  createdAt: string
  parentReplyId?: number
  nestedReplies?: Reply[]
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

export default function PostDetailPage() {
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [newComment, setNewComment] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set())
  const [replies, setReplies] = useState<Record<number, Reply[]>>({})
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({})
  const [nestedReplyInputs, setNestedReplyInputs] = useState<Record<string, string>>({})
  const [showReplyForm, setShowReplyForm] = useState<Record<string, boolean>>({})
  const [showImageModal, setShowImageModal] = useState<string | null>(null)
  const [showPostMenu, setShowPostMenu] = useState(false)
  const [showCommentMenus, setShowCommentMenus] = useState<Record<number, boolean>>({})
  const [editingComment, setEditingComment] = useState<number | null>(null)
  const [editCommentContent, setEditCommentContent] = useState("")

  const { id: groupId, postid } = useParams() as { id: string; postid: string }
  const postId = postid
  const router = useRouter()

  const { isLoading: permissionsLoading, isMemberOrAbove } = useGroupPermissions()

  useEffect(() => {
    loadCurrentUser()
    loadPost()
  }, [groupId, postId])

  useEffect(() => {
    const handleImageClick = (e: Event) => {
      const target = e.target as HTMLImageElement
      if (target.tagName === "IMG" && target.closest("#post-content")) {
        setShowImageModal(target.src)
      }
    }

    document.addEventListener("click", handleImageClick)
    return () => document.removeEventListener("click", handleImageClick)
  }, [post])

  const loadCurrentUser = async () => {
    try {
      const response = await api.get("/users/me", { withCredentials: true })
      setCurrentUser(response.data.result)
    } catch (error) {
      console.error("사용자 정보 로드 실패:", error)
    }
  }

  const loadPost = async () => {
    try {
      setLoading(true)
      const headers = await getAuthHeaders()
      const response = await api.get(`/groups/${groupId}/posts/${postId}`, { headers, withCredentials: true })
      setPost(response.data.result)
    } catch (error) {
      console.error("게시글 로드 실패:", error)
      alert("게시글을 불러올 수 없습니다.")
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const loadReplies = async (commentId: number) => {
    try {
      const response = await api.get(`/groups/${groupId}/posts/${postId}/comments/${commentId}`, {
        withCredentials: true,
      })
      const repliesData = response.data.result || []

      // 중첩 댓글 구조 생성
      const organizedReplies = organizeNestedReplies(repliesData)
      setReplies((prev) => ({
        ...prev,
        [commentId]: organizedReplies,
      }))
    } catch (error) {
      console.error("대댓글 로드 실패:", error)
    }
  }

  // 중첩 댓글 구조 생성 함수
  const organizeNestedReplies = (repliesData: Reply[]): Reply[] => {
    const replyMap = new Map<number, Reply>()
    const rootReplies: Reply[] = []

    // 모든 댓글을 맵에 저장
    repliesData.forEach((reply) => {
      replyMap.set(reply.id, { ...reply, nestedReplies: [] })
    })

    // 부모-자식 관계 설정
    repliesData.forEach((reply) => {
      const replyObj = replyMap.get(reply.id)!

      if (reply.parentReplyId) {
        const parentReply = replyMap.get(reply.parentReplyId)
        if (parentReply) {
          if (!parentReply.nestedReplies) {
            parentReply.nestedReplies = []
          }
          parentReply.nestedReplies.push(replyObj)
        }
      } else {
        rootReplies.push(replyObj)
      }
    })

    return rootReplies
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatCommentDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffTime / (1000 * 60))
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffMinutes < 60) {
      return `${diffMinutes}분 전`
    } else if (diffHours < 24) {
      return `${diffHours}시간 전`
    } else if (diffDays < 7) {
      return `${diffDays}일 전`
    }
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
  }

  const handleEditPost = () => {
    router.push(`/meeting/group/${groupId}/posts/${postId}/edit`)
  }

  const handleDeletePost = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return
    try {
      await api.delete(`/groups/${groupId}/posts/${postId}`, { withCredentials: true })
      alert("게시글이 삭제되었습니다.")
      router.push(`/meeting/group/${groupId}/posts`)
    } catch (error) {
      console.error("게시글 삭제 실패:", error)
      alert("삭제 중 오류가 발생했습니다.")
    }
  }

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return
    try {
      setIsSubmittingComment(true)
      const headers = await getAuthHeaders()
      await api.post(`/groups/${groupId}/posts/${postId}/comments`, { content: newComment }, { headers })
      setNewComment("")
      await loadPost()
    } catch (error) {
      console.error("댓글 작성 실패:", error)
      alert("댓글 작성 중 오류가 발생했습니다.")
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleEditComment = async (commentId: number) => {
    if (!editCommentContent.trim()) return

    try {
      const token = localStorage.getItem("accessToken")
      if (!token) throw new Error("로그인 후 이용해주세요.")

      await api.patch(
        `/groups/${groupId}/posts/${postId}/comments/${commentId}`,
        { content: editCommentContent },
        {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        },
      )

      setEditingComment(null)
      setEditCommentContent("")
      await loadPost()
    } catch (err: any) {
      const status = err.response?.status
      if (status === 401) {
        alert("인증이 만료되었습니다. 다시 로그인해주세요.")
        router.push("/login")
      } else if (status === 403) {
        alert("댓글 수정 권한이 없습니다.")
      } else {
        alert(`댓글 수정 중 오류가 발생했습니다 (${status || err.message})`)
      }
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return

    try {
      await api.delete(`/groups/${groupId}/posts/${postId}/comments/${commentId}`)
      await loadPost()
    } catch (error) {
      console.error("댓글 삭제 실패:", error)
      alert("댓글 삭제 중 오류가 발생했습니다.")
    }
  }

  const handleSubmitReply = async (commentId: number) => {
    const replyContent = replyInputs[commentId]
    if (!replyContent?.trim()) return

    try {
      await api.post(`/groups/${groupId}/posts/${postId}/comments/${commentId}`, {
        content: replyContent,
      })

      setReplyInputs((prev) => ({ ...prev, [commentId]: "" }))
      await loadReplies(commentId)
      await loadPost()
    } catch (error) {
      console.error("대댓글 작성 실패:", error)
      alert("대댓글 작성 중 오류가 발생했습니다.")
    }
  }

  const handleSubmitNestedReply = async (commentId: number, parentReplyId: number) => {
    const replyKey = `${commentId}-${parentReplyId}`
    const replyContent = nestedReplyInputs[replyKey]
    if (!replyContent?.trim()) return

    try {
      await api.post(`/groups/${groupId}/posts/${postId}/comments/${commentId}`, {
        content: replyContent,
        parentReplyId: parentReplyId,
      })

      setNestedReplyInputs((prev) => ({ ...prev, [replyKey]: "" }))
      setShowReplyForm((prev) => ({ ...prev, [replyKey]: false }))
      await loadReplies(commentId)
      await loadPost()
    } catch (error) {
      console.error("중첩 댓글 작성 실패:", error)
      alert("댓글 작성 중 오류가 발생했습니다.")
    }
  }

  const toggleReplies = async (commentId: number) => {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies((prev) => {
        const newSet = new Set(prev)
        newSet.delete(commentId)
        return newSet
      })
    } else {
      setExpandedReplies((prev) => new Set(prev).add(commentId))
      if (!replies[commentId]) {
        await loadReplies(commentId)
      }
    }
  }

  const toggleNestedReplyForm = (commentId: number, replyId: number) => {
    const key = `${commentId}-${replyId}`
    setShowReplyForm((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const canEditThisPost = () => {
    return post && currentUser && post.userId === currentUser.id
  }

  const canDeleteThisPost = () => {
    return post && currentUser && post.userId === currentUser.id
  }

  const canEditComment = (comment: Comment) => {
    return currentUser && comment.userId === currentUser.id
  }

  const canDeleteComment = (comment: Comment) => {
    return currentUser && comment.userId === currentUser.id
  }

  const togglePostMenu = () => {
    setShowPostMenu(!showPostMenu)
  }

  const toggleCommentMenu = (commentId: number) => {
    setShowCommentMenus((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }))
  }

  const startEditComment = (comment: Comment) => {
    setEditingComment(comment.commentId)
    setEditCommentContent(comment.content)
    setShowCommentMenus({})
  }

  const cancelEditComment = () => {
    setEditingComment(null)
    setEditCommentContent("")
  }

  const renderNestedReplies = (nestedReplies: Reply[], commentId: number, depth = 0) => {
    if (!nestedReplies || nestedReplies.length === 0) return null

    return (
      <div className={styles.nestedRepliesContainer}>
        {nestedReplies.map((nestedReply) => (
          <div key={nestedReply.id}>
            <div className={styles.nestedReplyItem}>
              <img
                src={nestedReply.userImgUrl || "/placeholder.svg?height=24&width=24"}
                alt={nestedReply.userName}
                className={styles.nestedReplyAvatar}
              />
              <div className={styles.nestedReplyBody}>
                <div className={styles.nestedReplyHeader}>
                  <span className={styles.nestedReplyAuthor}>{nestedReply.userName}</span>
                  <span className={styles.nestedReplyDate}>{formatCommentDate(nestedReply.createdAt)}</span>
                </div>
                <div className={styles.nestedReplyText}>{nestedReply.content}</div>
                {isMemberOrAbove() && depth < 2 && (
                  <button
                    className={styles.replyToReplyButton}
                    onClick={() => toggleNestedReplyForm(commentId, nestedReply.id)}
                  >
                    답글
                  </button>
                )}
              </div>
            </div>

            {showReplyForm[`${commentId}-${nestedReply.id}`] && isMemberOrAbove() && (
              <div className={styles.replyForm}>
                <img
                  src={currentUser?.imageUrl || "/placeholder.svg?height=28&width=28"}
                  alt="내 프로필"
                  className={styles.replyAvatar}
                />
                <div className={styles.replyInputGroup}>
                  <textarea
                    value={nestedReplyInputs[`${commentId}-${nestedReply.id}`] || ""}
                    onChange={(e) =>
                      setNestedReplyInputs((prev) => ({
                        ...prev,
                        [`${commentId}-${nestedReply.id}`]: e.target.value,
                      }))
                    }
                    placeholder="답글을 입력하세요..."
                    className={styles.replyInput}
                    rows={2}
                  />
                  <button
                    onClick={() => handleSubmitNestedReply(commentId, nestedReply.id)}
                    disabled={!nestedReplyInputs[`${commentId}-${nestedReply.id}`]?.trim()}
                    className={styles.replySubmitButton}
                  >
                    <span className={styles.buttonIcon}>💬</span>
                    답글
                  </button>
                </div>
              </div>
            )}

            {nestedReply.nestedReplies &&
              depth < 2 &&
              renderNestedReplies(nestedReply.nestedReplies, commentId, depth + 1)}
          </div>
        ))}
      </div>
    )
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
    <div className={styles.postDetailContainer}>
      <div className={styles.postDetailCard}>
        <div className={styles.postDetailHeader}>
          <div className={styles.headerTop}>
            <button onClick={() => router.back()} className={styles.backButton}>
              <span className={styles.buttonIcon}>←</span>
              뒤로가기
            </button>

            {(canEditThisPost() || canDeleteThisPost()) && (
              <div className={styles.postMenuContainer}>
                <button onClick={togglePostMenu} className={styles.menuButton}>
                  <span className={styles.buttonIcon}>⋮</span>
                </button>
                {showPostMenu && (
                  <div className={styles.dropdownMenu}>
                    {canEditThisPost() && (
                      <button onClick={handleEditPost} className={styles.menuItem}>
                        <span className={styles.menuIcon}>✏️</span>
                        수정하기
                      </button>
                    )}
                    {canDeleteThisPost() && (
                      <button onClick={handleDeletePost} className={`${styles.menuItem} ${styles.deleteMenuItem}`}>
                        <span className={styles.menuIcon}>🗑️</span>
                        삭제하기
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.postAuthorInfo}>
            <img
              src={post.userImgUrl || "/placeholder.svg?height=40&width=40"}
              alt={post.userName}
              className={styles.postAuthor}
            />
            <div className={styles.authorDetails}>
              <div className={styles.authorName}>{post.userName}</div>
              <div className={styles.postDate}>{formatDateTime(post.createdAt)}</div>
            </div>
          </div>
        </div>

        <div className={styles.postDetailContent}>
          <div
            id="post-content"
            className={styles.postContent}
            dangerouslySetInnerHTML={{ __html: post.renderedContent }}
          />
        </div>
      </div>

      <div className={styles.commentSection}>
        <div className={styles.commentHeader}>
          <h3 className={styles.commentTitle}>
            <span className={styles.titleIcon}>💬</span>
            댓글 {post.commentNum}개
          </h3>
        </div>

        <div className={styles.commentContent}>
          {isMemberOrAbove() && (
            <div className={styles.commentForm}>
              <img
                src={currentUser?.imageUrl || "/placeholder.svg?height=36&width=36"}
                alt="내 프로필"
                className={styles.commentAvatar}
              />
              <div className={styles.commentInputGroup}>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="댓글을 입력하세요..."
                  className={styles.commentInput}
                  rows={3}
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={isSubmittingComment || !newComment.trim()}
                  className={styles.commentSubmitButton}
                >
                  <span className={styles.buttonIcon}>💬</span>
                  {isSubmittingComment ? "작성 중..." : "댓글 작성"}
                </button>
              </div>
            </div>
          )}

          <div className={styles.commentList}>
            {post.comments.map((comment) => (
              <div key={comment.commentId} className={styles.commentItem}>
                <div className={styles.commentMain}>
                  <img
                    src={comment.userImgUrl || "/placeholder.svg?height=36&width=36"}
                    alt={comment.userName}
                    className={styles.commentAvatar}
                  />
                  <div className={styles.commentBody}>
                    <div className={styles.commentHeader}>
                      <span className={styles.commentAuthor}>{comment.userName}</span>
                      <span className={styles.commentDate}>{formatCommentDate(comment.createdAt)}</span>
                      {(canEditComment(comment) || canDeleteComment(comment)) && (
                        <div className={styles.commentMenuContainer}>
                          <button
                            onClick={() => toggleCommentMenu(comment.commentId)}
                            className={styles.commentMenuButton}
                          >
                            <span className={styles.buttonIcon}>⋮</span>
                          </button>
                          {showCommentMenus[comment.commentId] && (
                            <div className={styles.dropdownMenu}>
                              {canEditComment(comment) && (
                                <button onClick={() => startEditComment(comment)} className={styles.menuItem}>
                                  <span className={styles.menuIcon}>✏️</span>
                                  수정
                                </button>
                              )}
                              {canDeleteComment(comment) && (
                                <button
                                  onClick={() => handleDeleteComment(comment.commentId)}
                                  className={`${styles.menuItem} ${styles.deleteMenuItem}`}
                                >
                                  <span className={styles.menuIcon}>🗑️</span>
                                  삭제
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {editingComment === comment.commentId ? (
                      <div className={styles.editCommentForm}>
                        <textarea
                          value={editCommentContent}
                          onChange={(e) => setEditCommentContent(e.target.value)}
                          className={styles.editCommentInput}
                          rows={3}
                        />
                        <div className={styles.editCommentActions}>
                          <button onClick={cancelEditComment} className={styles.cancelEditButton}>
                            취소
                          </button>
                          <button
                            onClick={() => handleEditComment(comment.commentId)}
                            className={styles.saveEditButton}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.commentText}>{comment.content}</div>
                    )}

                    {comment.commentNum > 0 && (
                      <button onClick={() => toggleReplies(comment.commentId)} className={styles.replyToggleButton}>
                        {expandedReplies.has(comment.commentId) ? "접기" : `댓글 ${comment.commentNum}개`}
                      </button>
                    )}
                  </div>
                </div>

                {expandedReplies.has(comment.commentId) && (
                  <div className={styles.repliesContainer}>
                    {replies[comment.commentId]?.map((reply) => (
                      <div key={reply.id}>
                        <div className={styles.replyItem}>
                          <img
                            src={reply.userImgUrl || "/placeholder.svg?height=28&width=28"}
                            alt={reply.userName}
                            className={styles.replyAvatar}
                          />
                          <div className={styles.replyBody}>
                            <div className={styles.replyHeader}>
                              <span className={styles.replyAuthor}>{reply.userName}</span>
                              <span className={styles.replyDate}>{formatCommentDate(reply.createdAt)}</span>
                            </div>
                            <div className={styles.replyText}>{reply.content}</div>
                            {isMemberOrAbove() && (
                              <button
                                className={styles.replyToReplyButton}
                                onClick={() => toggleNestedReplyForm(comment.commentId, reply.id)}
                              >
                                답글
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 중첩 댓글 작성 폼 */}
                        {showReplyForm[`${comment.commentId}-${reply.id}`] && isMemberOrAbove() && (
                          <div className={styles.replyForm}>
                            <img
                              src={currentUser?.imageUrl || "/placeholder.svg?height=28&width=28"}
                              alt="내 프로필"
                              className={styles.replyAvatar}
                            />
                            <div className={styles.replyInputGroup}>
                              <textarea
                                value={nestedReplyInputs[`${comment.commentId}-${reply.id}`] || ""}
                                onChange={(e) =>
                                  setNestedReplyInputs((prev) => ({
                                    ...prev,
                                    [`${comment.commentId}-${reply.id}`]: e.target.value,
                                  }))
                                }
                                placeholder="답글을 입력하세요..."
                                className={styles.replyInput}
                                rows={2}
                              />
                              <button
                                onClick={() => handleSubmitNestedReply(comment.commentId, reply.id)}
                                disabled={!nestedReplyInputs[`${comment.commentId}-${reply.id}`]?.trim()}
                                className={styles.replySubmitButton}
                              >
                                <span className={styles.buttonIcon}>💬</span>
                                답글
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 중첩 댓글 렌더링 */}
                        {reply.nestedReplies && renderNestedReplies(reply.nestedReplies, comment.commentId, 0)}
                      </div>
                    ))}

                    {isMemberOrAbove() && (
                      <div className={styles.replyForm}>
                        <img
                          src={currentUser?.imageUrl || "/placeholder.svg?height=28&width=28"}
                          alt="내 프로필"
                          className={styles.replyAvatar}
                        />
                        <div className={styles.replyInputGroup}>
                          <textarea
                            value={replyInputs[comment.commentId] || ""}
                            onChange={(e) =>
                              setReplyInputs((prev) => ({
                                ...prev,
                                [comment.commentId]: e.target.value,
                              }))
                            }
                            placeholder="대댓글을 입력하세요..."
                            className={styles.replyInput}
                            rows={2}
                          />
                          <button
                            onClick={() => handleSubmitReply(comment.commentId)}
                            disabled={!replyInputs[comment.commentId]?.trim()}
                            className={styles.replySubmitButton}
                          >
                            <span className={styles.buttonIcon}>💬</span>
                            답글
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showImageModal && (
        <div className={styles.imageModalOverlay} onClick={() => setShowImageModal(null)}>
          <div className={styles.imageModalContent}>
            <img src={showImageModal || "/placeholder.svg"} alt="확대 이미지" />
          </div>
        </div>
      )}
    </div>
  )
}
