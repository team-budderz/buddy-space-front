"use client"

import { useEffect, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { format } from 'date-fns'

interface ModalPortalProps {
  children: React.ReactNode;
  isOpen: boolean;
}

// ModalPortal 컴포넌트 추가
const ModalPortal: React.FC<ModalPortalProps> = ({ children, isOpen }) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted || !isOpen) return null

  return createPortal(children, document.body)
}

import { useParams } from "next/navigation"
import { useGroupPermissions } from "@/app/components/hooks/usegrouppermissiont"
import api from "@/app/api"
import styles from "./missionregister.module.css"

const today = new Date()
today.setHours(0, 0, 0, 0)

function isWithinPeriod(start: string, end: string): boolean {
  const s = new Date(start)
  const e = new Date(end)
  s.setHours(0, 0, 0, 0)
  e.setHours(0, 0, 0, 0)
  return s <= today && today <= e
}

interface Mission {
  missionId: number
  title: string
  description: string
  startedAt: string
  endedAt: string
  frequency: number
  progressDay: number
  authorName: string
  authorId: number; 
}

interface MissionDetail {
  id: number 
  title: string
  description: string
  startedAt: string
  endedAt: string
  frequency: number
  authorName: string
  authorImageUrl: string
  createdAt: string 
}

interface MissionPost {
  missionPostId: number
  missionId: number
  contents: string
  authorId: number
  authorName: string
  createdAt: string
  missionTitle: string
}

interface MissionPostDetail {
  missionPostId: number
  missionId: number
  contents: string
  missionTitle: string
  authorName: string
  authorImageUrl: string
  createdAt: string
}


async function getAuthHeaders(): Promise<{ Authorization: string; "Content-Type": string }> {
  const token = await getValidToken()
  if (!token) throw new Error("토큰이 없습니다. 로그인해주세요.")
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

const getAuthToken = () => {
  if (typeof window === "undefined") return null
  return localStorage.getItem("accessToken") || localStorage.getItem("token")
}

const isTokenValid = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    const currentTime = Math.floor(Date.now() / 1000)
    return payload.exp > currentTime
  } catch (error) {
    console.error("토큰 디코딩 실패:", error)
    return false
  }
}

const getValidToken = async (): Promise<string | null> => {
  const token = getAuthToken()
  if (!token) return null

  if (!isTokenValid(token)) {
    try {
      const email = localStorage.getItem("userEmail")
      const password = localStorage.getItem("userPassword")

      if (!email || !password) return null

      const res = await api.post("/token/refresh", { email, password })
      const newToken = res.data.result?.accessToken

      if (newToken) {
        localStorage.setItem("accessToken", newToken)
        return newToken
      } else {
        return null
      }
    } catch (err) {
      console.error("토큰 재발급 실패:", err)
      return null
    }
  }

  return token
}

export default function MissionsPage() {
  const { id: groupId } = useParams()
  const { getCurrentUserId, getCurrentUserRole, isSubLeaderOrAbove, isMemberOrAbove, hasPermission } = useGroupPermissions()
  const [tab, setTab] = useState<"missions" | "posts">("missions")

  const [missions, setMissions] = useState<Mission[]>([])
  const [missionForm, setMissionForm] = useState({
    title: "",
    description: "",
    startedAt: "",
    endedAt: "",
    frequency: 1,
  })
  const [editingMissionId, setEditingMissionId] = useState<number | null>(null)
  const [showMissionModal, setShowMissionModal] = useState(false)

  const [posts, setPosts] = useState<MissionPost[]>([])
  const [postForm, setPostForm] = useState({ contents: "" })
  const [editingPost, setEditingPost] = useState<MissionPost | null>(null)

  const [detailMission, setDetailMission] = useState<MissionDetail | null>(null)
  const [detailPost, setDetailPost] = useState<MissionPostDetail | null>(null)
  const [postModal, setPostModal] = useState(false)

  const currentUserId = getCurrentUserId()
  const currentUserRole = getCurrentUserRole()
  const [currentUserName, setCurrentUserName] = useState<string | null>(null) 
  const [missionForPost, setMissionForPost] = useState<number | null>(null)

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const res = await api.get("/users/me")
        if (res.data.result && res.data.result.name) {
          setCurrentUserName(res.data.result.name)
          console.log("[DEBUG] currentUserName 설정됨:", res.data.result.name)
        }
      } catch (error) {
        console.error("Failed to fetch current user name:", error)
      }
    }
    fetchUserName()
  }, [])

  useEffect(() => {
    if (groupId) {
      loadMissions()
    }
  }, [groupId])

  // 권한 체크 
  const canCreateMission = (): boolean => {
    return hasPermission("CREATE_MISSION")
  }

  const canEditMission = (mission: Mission): boolean => {
    if (!currentUserName) return false
    return mission.authorName === currentUserName
  }

  const canDeleteMission = (mission: Mission): boolean => {
    if (!currentUserName) return false
    return mission.authorName === currentUserName || hasPermission("DELETE_MISSION")
  }

  const canCreatePost = (): boolean => {
    return isMemberOrAbove()
  }

  const canEditPost = (post: MissionPost): boolean => {
    if (!currentUserName) return false
    return post.authorName === currentUserName
  }

  const canDeletePost = (post: MissionPost): boolean => {
    if (!currentUserName) return false
    return post.authorName === currentUserName
  }

  async function loadMissions() {
    try {
      const headers = await getAuthHeaders()
      const response = await api.get(`/groups/${groupId}/missions`, { headers })
      if (response.status === 200 && response.data.result) {
        setMissions(response.data.result || [])
      }
    } catch (err) {
      console.error("Failed to load missions", err)
      alert("미션 목록을 불러오는데 실패했습니다.")
    }
  }

  function cancelMissionModal() {
    setShowMissionModal(false)
    setEditingMissionId(null)
  }

  function cancelPostModal() {
    setPostModal(false)
    setEditingPost(null)
    setMissionForPost(null)
  }

  async function loadMissionDetail(missionId: number) {
    try {
      const headers = await getAuthHeaders()
      const response = await api.get(`/groups/${groupId}/missions/${missionId}`, { headers })
      if (response.status === 200 && response.data.result) {
        const detail = response.data.result
        setDetailMission({
          ...detail,
          missionId: detail.id,
        })
      }
    } catch (err) {
      console.error("Failed to load mission detail", err)
      alert("미션 상세 정보를 불러오는데 실패했습니다.")
    }
  }

  useEffect(() => {
    if (tab === "posts" && missions.length > 0) loadAllPosts()
  }, [tab, missions])

  async function loadAllPosts() {
    try {
      const headers = await getAuthHeaders()
      const all: MissionPost[] = []
      for (const m of missions) {
        const response = await api.get(`/groups/${groupId}/missions/${m.missionId}/posts`, { headers })
        if (response.status === 200 && response.data.result) {
          console.log("[DEBUG] loadAllPosts - 백엔드 응답 (raw):", response.data.result)
          const postsWithMissionId = response.data.result.map((p: any) => ({
            missionPostId: p.missionPostId,
            contents: p.contents,
            authorId: p.authorId, 
            authorName: p.authorName, 
            missionId: m.missionId, 
            createdAt: p.createdAt,
            missionTitle: m.title,
          }))
          all.push(...postsWithMissionId)
        }
      }
      console.log("[DEBUG] loadAllPosts - 필터링 전 모든 인증 게시물:", all)
      setPosts(all)
    } catch (err) {
      console.error("Failed to load posts", err)
      alert("인증 목록을 불러오는데 실패했습니다.")
    }
  }

  function openMissionModal() {
    if (!canCreateMission()) {
      alert("미션을 생성할 권한이 없습니다.")
      return
    }
    setMissionForm({ title: "", description: "", startedAt: "", endedAt: "", frequency: 1 })
    setEditingMissionId(null)
    setShowMissionModal(true)
  }

  const handleMissionSubmit = async (e: FormEvent) => {
    e.preventDefault()

    try {
      const headers = await getAuthHeaders()

      if (editingMissionId) {
        const mission = missions.find((m) => m.missionId === editingMissionId)!
        if (!canEditMission(mission)) {
          alert("수정 권한이 없습니다.")
          return
        }

        await api.patch(
          `/groups/${groupId}/missions/${editingMissionId}`,
          {
            title: missionForm.title,
            description: missionForm.description,
          },
          { headers },
        )
      } else {
        if (!canCreateMission()) {
          alert("미션 생성 권한이 없습니다.")
          return
        }

        await api.post(
          `/groups/${groupId}/missions`,
          {
            title: missionForm.title,
            description: missionForm.description,
            startedAt: missionForm.startedAt,
            endedAt: missionForm.endedAt,
            frequency: missionForm.frequency,
          },
          { headers },
        )
      }

      setMissionForm({ title: "", description: "", startedAt: "", endedAt: "", frequency: 1 })
      setEditingMissionId(null)
      setShowMissionModal(false)
      await loadMissions()
      alert(editingMissionId ? "미션이 수정되었습니다." : "미션이 생성되었습니다.")
    } catch (err) {
      console.error("Failed to save mission", err)
      alert("미션 저장에 실패했습니다.")
    }
  }

  function startEditMission(m: Mission) {
    if (!canEditMission(m)) {
      alert("수정 권한이 없습니다.")
      return
    }

    setEditingMissionId(m.missionId)
    setMissionForm({
      title: m.title,
      description: m.description,
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      frequency: 1,
    })
    setShowMissionModal(true)
  }

  async function deleteMission(mission: Mission) {
    if (!canDeleteMission(mission)) {
      alert("삭제 권한이 없습니다.")
      return
    }

    if (!confirm("삭제하시겠습니까?")) return

    try {
      const headers = await getAuthHeaders()
      await api.delete(`/groups/${groupId}/missions/${mission.missionId}`, { headers })
      loadMissions()
      alert("미션이 삭제되었습니다.")
    } catch (err) {
      console.error("Failed to delete mission", err)
      alert("삭제에 실패했습니다.")
    }
  }

  function handleMissionClick(mission: Mission) {
    setMissionForPost(mission.missionId)
    loadMissionDetail(mission.missionId)
  }

  function startEditPost(p: MissionPost) {
    if (!canEditPost(p)) {
      alert("수정 권한이 없습니다.")
      return
    }

    setEditingPost(p)
    setPostForm({ contents: p.contents })
    setPostModal(true)
  }

  async function handlePostSubmit(e: FormEvent) {
    e.preventDefault()

    try {
      const headers = await getAuthHeaders()

      if (editingPost) {
        if (!canEditPost(editingPost)) {
          alert("수정 권한이 없습니다.")
          return
        }

        const response = await api.patch(
          `/groups/${groupId}/missions/${(editingPost as any).missionId}/posts/${editingPost.missionPostId}`,
          { contents: postForm.contents },
          { headers },
        )

        if (response.status === 200) {
          alert("인증이 수정되었습니다.")
          setPostForm({ contents: "" })
          setEditingPost(null)
          setPostModal(false)
          await loadAllPosts()
        }
      }

      const missionId = missionForPost
      if (!missionId) {
        alert("미션을 먼저 선택해주세요.")
        return
      }

      if (!canCreatePost()) {
        alert("인증 생성 권한이 없습니다.")
        return
      }

      const response = await api.post(
        `/groups/${groupId}/missions/${missionForPost}/posts`,
        { contents: postForm.contents },
        { headers },
      )

      if (response.status === 200) {
        alert("인증이 등록되었습니다.")
        setPostForm({ contents: "" })
        setPostModal(false)
        await loadAllPosts()
      }
    } catch (err) {
      console.error("Failed to save post", err)
      alert("인증 저장에 실패했습니다.")
    }
  }

  async function deletePost(p: MissionPost) {
    if (!canDeletePost(p)) {
      alert("삭제 권한이 없습니다.")
      return
    }

    if (!confirm("삭제하시겠습니까?")) return

    try {
      const headers = await getAuthHeaders()
      await api.delete(`/groups/${groupId}/missions/${(p as any).missionId}/posts/${p.missionPostId}`, { headers })
      loadAllPosts()
      alert("인증이 삭제되었습니다.")
    } catch (err) {
      console.error("Failed to delete post", err)
      alert("삭제에 실패했습니다.")
    }
  }

  async function loadPostDetail(missionId: number, postId: number) {
    try {
      const headers = await getAuthHeaders()
      const response = await api.get(`/groups/${groupId}/missions/${missionId}/posts/${postId}`, { headers })
      if (response.status === 200 && response.data.result) {
        const dto = response.data.result
        setDetailPost({
          missionPostId: postId,      
          missionId: missionId,      
          contents: dto.contents,
          missionTitle: dto.missionTitle,
          authorName: dto.authorName,
          authorImageUrl: dto.authorImageUrl,
          createdAt: dto.createdAt,
        })
      }
    } catch (err) {
      console.error("Failed to load post detail", err)
      alert("인증 상세 정보를 불러오는데 실패했습니다.")
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>미션 관리</h1>
        {tab === "missions" && canCreateMission() && (
          <button className={styles.addButton} onClick={openMissionModal}>
            미션 추가
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        <button className={tab === "missions" ? styles.active : ""} onClick={() => setTab("missions")}>
          미션 관리
        </button>
        <button className={tab === "posts" ? styles.active : ""} onClick={() => setTab("posts")}>
          인증 관리
        </button>
      </div>

      {tab === "missions" && (
        <>
          {missions.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>등록된 미션이 없습니다</h3>
              <p>새로운 미션을 추가해보세요!</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {missions.map((m) => (
                <li key={m.missionId} className={styles.listItem}>
                  <div
                    className={styles.listTitle}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMissionClick(m)
                    }}
                  >
                    <div>{m.title}</div>
                    <div className={styles.listMeta}>
                      {m.startedAt} ~ {m.endedAt} | 진행일: {m.progressDay}일
                    </div>
                    <div className={styles.listAuthor}>작성자: {m.authorName}</div>
                  </div>
                  <div className={styles.itemActions} onClick={(e) => e.stopPropagation()}>
                    {canEditMission(m) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditMission(m)
                        }}
                        title="수정"
                      >
                        ✏️
                      </button>
                    )}
                    {canDeleteMission(m) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteMission(m)
                        }}
                        title="삭제"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "posts" && (
        <>
          {posts.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>등록된 인증이 없습니다</h3>
              <p>미션을 완료하고 인증을 등록해보세요!</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {posts.map((p) => (
                <li key={p.missionPostId} className={styles.listItem}>
                  <div
                    className={styles.listTitle}
                    onClick={(e) => {
                      e.stopPropagation()
                      loadPostDetail((p as any).missionId, p.missionPostId)
                    }}
                  >
                    <div>{p.missionTitle} - {p.authorName}</div>
                    <div className={styles.listMeta}>
                      {p.createdAt ? format(new Date(p.createdAt), 'yyyy.MM.dd') : ''}
                    </div>
                    
                  </div>
                  <div className={styles.itemActions} onClick={(e) => e.stopPropagation()}>
                    {canEditPost(p) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditPost(p)
                        }}
                        title="수정"
                      >
                        ✏️
                      </button>
                    )}
                    {canDeletePost(p) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deletePost(p)
                        }}
                        title="삭제"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ModalPortal isOpen={showMissionModal}>
        <div className={styles.modalOverlay} onClick={() => setShowMissionModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingMissionId ? "미션 수정" : "새 미션 추가"}</h2>
            <form onSubmit={handleMissionSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>제목</label>
                <input
                  placeholder="미션 제목을 입력하세요"
                  value={missionForm.title}
                  onChange={(e) => setMissionForm({ ...missionForm, title: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>설명</label>
                <textarea
                  placeholder="미션 설명을 입력하세요"
                  value={missionForm.description}
                  onChange={(e) => setMissionForm({ ...missionForm, description: e.target.value })}
                  required
                />
              </div>
              {!editingMissionId && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>시작일</label>
                    <input
                      type="date"
                      value={missionForm.startedAt}
                      onChange={(e) => setMissionForm({ ...missionForm, startedAt: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>종료일</label>
                    <input
                      type="date"
                      value={missionForm.endedAt}
                      onChange={(e) => setMissionForm({ ...missionForm, endedAt: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={cancelMissionModal}>
                  취소
                </button>
                <button type="submit" className={styles.submitButton}>
                  {editingMissionId ? "수정 완료" : "등록 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      <ModalPortal isOpen={!!detailMission}>
        {detailMission && (
          <div className={styles.modalOverlay} onClick={() => setDetailMission(null)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.detailHeader}>
              <div className={styles.authorInfo}>
                <img
                  src={detailMission.authorImageUrl || "/placeholder.svg"}
                  alt="avatar"
                  className={styles.avatar}
                />
                <div>
                  <div className={styles.authorName}>{detailMission.authorName}</div>
                  <div className={styles.postDate}>
                    {format(new Date(detailMission.createdAt), 'yyyy년 MM월 dd일')}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.detailBody}>
              <h3>기간 </h3>
              <div className={styles.detailDates}>
                {detailMission.startedAt} ~ {detailMission.endedAt}
              </div>
              <h3 className={styles.detailTitle}>미션 : {detailMission.title}</h3>
              <div className={styles.detailContent}>{detailMission.description}</div>
            </div>
              <div className={styles.modalActions}>
                <button
                  className={styles.cancelButton}
                  onClick={(e) => {
                    e.stopPropagation()
                    setDetailMission(null)
                  }}
                >
                  닫기
                </button>
                {detailMission && isWithinPeriod(detailMission.startedAt, detailMission.endedAt) ? (
                  <button
                    className={styles.submitButton}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMissionForPost(detailMission.id) 
                      setPostModal(true)
                    }}
                  >
                    미션하기
                  </button>
                ) : (
                  <button
                    className={`${styles.submitButton} ${styles.disabled}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      alert(`${detailMission.startedAt} 이후에 미션을 수행할 수 있습니다.`)
                    }}
                  >
                    미션하기
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </ModalPortal>

      <ModalPortal isOpen={!!detailPost}>
        {detailPost && (
          <div className={styles.modalOverlay} onClick={() => setDetailPost(null)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.detailHeader}>
              <div className={styles.authorInfo}>
                <img
                  src={detailPost.authorImageUrl || "/placeholder.svg"}
                  alt="avatar"
                  className={styles.avatar}
                />
                <div>
                  <div className={styles.authorName}>{detailPost.authorName}</div>
                  <div className={styles.postDate}>
                    {format(new Date(detailPost.createdAt), 'yyyy년 MM월 dd일')}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.detailBody}>
              <h3 className={styles.detailTitle}>인증 내용</h3>
              <div className={styles.detailContent}>{detailPost.contents}</div>
            </div>
              <div className={styles.modalActions}>
                <button className={styles.cancelButton} onClick={() => setDetailPost(null)}>
                  닫기
                </button>
                {detailPost.authorName === currentUserName && (
                  <>
                    {(() => {
                      const post: MissionPost = {
                        missionPostId: detailPost.missionPostId,
                        missionId: detailPost.missionId,
                        contents: detailPost.contents,
                        authorId: currentUserId!,
                        authorName: detailPost.authorName,
                        createdAt: detailPost.createdAt,
                        missionTitle: detailPost.missionTitle,
                      }
                      return (
                        <>
                          <button
                            className={styles.submitButton}
                            onClick={() => {
                              setDetailPost(null)
                              startEditPost(post)
                            }}
                          >
                            수정
                          </button>
                          <button
                            className={`${styles.submitButton} ${styles.dangerButton}`}
                            onClick={() => {
                              setDetailPost(null)
                              deletePost(post)
                            }}
                          >
                            삭제
                          </button>
                        </>
                      )
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </ModalPortal>

      <ModalPortal isOpen={postModal || !!editingPost}>
        <div className={styles.modalOverlay} onClick={cancelPostModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{editingPost ? "인증 수정" : "인증 등록"}</h3>
            <form onSubmit={handlePostSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>인증 내용</label>
                <textarea
                  placeholder="인증 내용을 입력하세요"
                  value={postForm.contents}
                  onChange={(e) => setPostForm({ contents: e.target.value })}
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={cancelPostModal}>
                  취소
                </button>
                <button type="submit" className={styles.submitButton}>
                  {editingPost ? "수정 완료" : "등록 완료"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>
    </div>
  )
}