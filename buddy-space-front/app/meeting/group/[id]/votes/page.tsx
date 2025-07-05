"use client"

import type React from "react"
import { useEffect, useState, type FormEvent } from "react"
import { format, parseISO } from 'date-fns'
import { useParams } from "next/navigation"
import { createPortal } from "react-dom"
import { useGroupPermissions } from "../layout"
import api from "@/app/api"
import styles from "./votes.module.css"

interface VoteSummary {
  voteId: number
  title: string
  isClosed: boolean
  authorName: string
  authorId: number
  createdAt: string
}

interface VoteOption {
  voteOptionId: number
  voteOptionName: string
  voteCount: number
  voterName: string[]
}

interface VoteDetail {
  voteId: number
  title: string
  isClosed: boolean
  isAnonymous: boolean
  options: VoteOption[]
  authorName: string
  authorId: number
  authorImageUrl: string | null
  createdAt: string
}

interface VoteForm {
  title: string
  options: string[]
  isAnonymous: boolean
}

function ModalPortal({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted || !isOpen) return null

  return createPortal(children, document.body)
}

export default function VotePage() {
  const { id: groupId } = useParams()
  const { getCurrentUserId, getCurrentUserRole, isSubLeaderOrAbove, isMemberOrAbove, hasPermission } = useGroupPermissions()

  const [votes, setVotes] = useState<VoteSummary[]>([])
  const [loading, setLoading] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const [voteForm, setVoteForm] = useState<VoteForm>({
    title: "",
    options: ["", ""],
    isAnonymous: true,
  })
  const [editingVoteId, setEditingVoteId] = useState<number | null>(null)

  const [selectedVote, setSelectedVote] = useState<VoteDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [submittingVote, setSubmittingVote] = useState(false)

  const [menuVisible, setMenuVisible] = useState<{ [key: number]: boolean }>({})

  const rawUserId = getCurrentUserId()
  const currentUserId = rawUserId === undefined ? null : Number(rawUserId)
  const [currentUserName, setCurrentUserName] = useState<string | null>(null) // 현재 사용자 이름 상태 추가
  const [detailSummary, setDetailSummary] = useState<VoteSummary | null>(null)

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const res = await api.get("/users/me")
        if (res.data.result && res.data.result.name) {
          setCurrentUserName(res.data.result.name)
        }
      } catch (error) {
        console.error("Failed to fetch current user name:", error)
      }
    }
    fetchUserName()
  }, [])

  // 투표 수정 : 오직 작성자 본인만 (이름 비교)
  const canEditVote = (vote: VoteSummary | VoteDetail): boolean => {
    if (!currentUserName) return false
    return vote.authorName === currentUserName
  }

  // 투표 삭제: 작성자 본인 (이름 비교) or DELETE_VOTE 권한
  const canDeleteVote = (vote: VoteSummary | VoteDetail): boolean => {
    if (!currentUserName) return false
    return vote.authorName === currentUserName || hasPermission("DELETE_VOTE")
  }

  // 투표 생성권한: CREATE_VOTE 권한
  const canCreateVote = (): boolean => {
    return hasPermission("CREATE_VOTE")
  }

  // 투표 종료권한: 오직 작성자 본인만 (이름 비교)
  const canCloseVote = (vote: VoteDetail): boolean => {
    if (!currentUserName) return false
    return vote.authorName === currentUserName
  }


  useEffect(() => {
    if (groupId) {
      fetchVotes()
    }
  }, [groupId])

  const fetchVotes = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/groups/${groupId}/votes`)
      if (response.status === 200 && response.data.result) {
        const list: VoteSummary[] = response.data.result.map((v: any) => ({
          voteId: v.voteId,
          title: v.title,
          isClosed: v.isClosed,
          authorName: v.authorName,
          authorId: v.authorId,
          createdAt: v.createdAt,
        }))
        setVotes(list)
      }
    } catch (error) {
      console.error("Failed to fetch votes:", error)
      alert("투표 목록을 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }


  const fetchVoteDetail = async (voteId: number) => {
    setLoadingDetail(true)
    try {
      const summary = votes.find(v => v.voteId === voteId)

      const response = await api.get(`/groups/${groupId}/votes/${voteId}`)
      if (response.status === 200 && response.data.result) {
        const detailFromApi: VoteDetail = response.data.result
        let authorImageUrl = detailFromApi.authorImageUrl || "/placeholder.svg" // Use existing image or default
        try {
          if (!detailFromApi.authorImageUrl && detailFromApi.authorId) { // Only fetch if not already provided and authorId exists
            const userRes = await api.get(`/users/${detailFromApi.authorId}`)
            if (userRes.data.result && userRes.data.result.imageUrl) {
              authorImageUrl = userRes.data.result.imageUrl
            }
          }
        } catch (userErr) {
          console.error("Failed to fetch author image:", userErr)
        }

        setSelectedVote({
          ...detailFromApi,
          authorId: detailFromApi.authorId ?? summary!.authorId,
          authorImageUrl: authorImageUrl,
        })
        setShowDetailModal(true)
      }
    } catch (error) {
      console.error("Failed to fetch vote detail:", error)
      alert("투표 상세 정보를 불러오는데 실패했습니다.")
    } finally {
      setLoadingDetail(false)
    }
  }


  const handleCreateVote = async (e: FormEvent) => {
    e.preventDefault()

    if (!canCreateVote()) {
      alert("투표 생성 권한이 없습니다.")
      return
    }

    if (!voteForm.title.trim() || voteForm.options.some((opt) => !opt.trim())) {
      alert("제목과 모든 옵션을 입력해주세요.")
      return
    }

    try {
      await api.post(`/groups/${groupId}/votes`, {
        title: voteForm.title,
        options: voteForm.options.filter((opt) => opt.trim()),
        isAnonymous: voteForm.isAnonymous,
      })

      alert("투표가 생성되었습니다.")
      setShowCreateModal(false)
      resetForm()
      fetchVotes()
    } catch (error) {
      console.error("Failed to create vote:", error)
      alert("투표 생성에 실패했습니다.")
    }
  }

  const handleUpdateVote = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingVoteId) return

    const vote = votes.find((v) => v.voteId === editingVoteId)
    if (!vote || !canEditVote(vote)) {
      alert("수정 권한이 없습니다.")
      return
    }

    try {
      await api.put(`/groups/${groupId}/votes/${editingVoteId}`, {
        title: voteForm.title,
        options: voteForm.options.filter((opt) => opt.trim()),
        isAnonymous: voteForm.isAnonymous,
      })

      alert("투표가 수정되었습니다.")
      setShowEditModal(false)
      resetForm()
      fetchVotes()
      if (selectedVote && selectedVote.voteId === editingVoteId) {
        fetchVoteDetail(editingVoteId)
      }
    } catch (error) {
      console.error("Failed to update vote:", error)
      alert("투표 수정에 실패했습니다.")
    }
  }

  const handleDeleteVote = async (voteId: number) => {
    const vote = votes.find((v) => v.voteId === voteId)
    if (!vote || !canDeleteVote(vote)) {
      alert("삭제 권한이 없습니다.")
      return
    }

    if (!confirm("정말 삭제하시겠습니까?")) return

    try {
      await api.delete(`/groups/${groupId}/votes/${voteId}`)
      alert("투표가 삭제되었습니다.")
      fetchVotes()
      if (selectedVote && selectedVote.voteId === voteId) {
        setShowDetailModal(false)
        setSelectedVote(null)
      }
    } catch (error) {
      console.error("Failed to delete vote:", error)
      alert("투표 삭제에 실패했습니다.")
    }
  }

  const handleSubmitVote = async (optionId: number) => {
    if (!selectedVote || selectedVote.isClosed) return

    setSubmittingVote(true)
    try {
      await api.post(`/groups/${groupId}/votes/${selectedVote.voteId}/submit`, {
        voteOptionIds: [optionId],
      })

      alert("투표가 완료되었습니다.")
      fetchVoteDetail(selectedVote.voteId)
      fetchVotes()
    } catch (error) {
      console.error("Failed to submit vote:", error)
      alert("투표에 실패했습니다.")
    } finally {
      setSubmittingVote(false)
    }
  }

  const handleCloseVote = async () => {
    if (!selectedVote || !canCloseVote(selectedVote)) {
      alert("투표 종료 권한이 없습니다.")
      return
    }

    if (!confirm("투표를 종료하시겠습니까?")) return

    try {
      await api.post(`/groups/${groupId}/votes/${selectedVote.voteId}/close`)
      alert("투표가 종료되었습니다.")
      fetchVoteDetail(selectedVote.voteId)
      fetchVotes()
    } catch (error) {
      console.error("Failed to close vote:", error)
      alert("투표 종료에 실패했습니다.")
    }
  }

  const resetForm = () => {
    setVoteForm({
      title: "",
      options: ["", ""],
      isAnonymous: true,
    })
    setEditingVoteId(null)
  }

  const addOption = () => {
    if (voteForm.options.length >= 10) {
      alert("최대 10개까지 추가 가능합니다.")
      return
    }
    setVoteForm({ ...voteForm, options: [...voteForm.options, ""] })
  }

  const removeOption = (index: number) => {
    if (voteForm.options.length <= 2) {
      alert("최소 2개의 옵션이 필요합니다.")
      return
    }
    const newOptions = voteForm.options.filter((_, i) => i !== index)
    setVoteForm({ ...voteForm, options: newOptions })
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...voteForm.options]
    newOptions[index] = value
    setVoteForm({ ...voteForm, options: newOptions })
  }

  const openEditModal = async (vote: VoteSummary) => {
    if (!canEditVote(vote)) {
      alert("수정 권한이 없습니다.")
      return
    }

    try {
      const response = await api.get(`/groups/${groupId}/votes/${vote.voteId}`)
      if (response.status === 200 && response.data.result) {
        const result = response.data.result
        setVoteForm({
          title: result.title,
          options: result.options.map((opt: any) => opt.voteOptionName),
          isAnonymous: result.isAnonymous,
        })
        setEditingVoteId(vote.voteId)
        setShowEditModal(true)
      }
    } catch (error) {
      console.error("Failed to load vote for editing:", error)
      alert("투표 정보를 불러오는데 실패했습니다.")
    }
  }

  const toggleMenu = (voteId: number) => {
    setMenuVisible((prev) => ({
      ...prev,
      [voteId]: !prev[voteId],
    }))
  }

  useEffect(() => {
    if (selectedVote) {
      console.log(
        "▶ currentUserId vs authorId:",
        currentUserId,
        selectedVote.authorId,
        "isSubLeaderOrAbove:",
        isSubLeaderOrAbove()
      )
    }
  }, [selectedVote, currentUserId, isSubLeaderOrAbove])

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>투표 관리</h1>
          {canCreateVote() && (
            <button className={styles.createButton} onClick={() => setShowCreateModal(true)}>
              투표 만들기
            </button>
          )}
        </div>

        {loading ? (
          <div className={styles.loading}>투표 목록을 불러오는 중...</div>
        ) : votes.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>등록된 투표가 없습니다</h3>
            <p>새로운 투표를 만들어보세요!</p>
          </div>
        ) : (
          <ul className={styles.voteList}>
            {votes.map((vote) => {
              console.log(`[VOTE LIST] Vote ID: ${vote.voteId}, Author ID: ${vote.authorId}, Current User ID: ${currentUserId}`)
              return (
                <li key={vote.voteId} className={styles.voteItem}>
                  {/* voteId 숫자를 넘겨줍니다 */}
                  <div
                    className={styles.voteContent}
                    onClick={() => fetchVoteDetail(vote.voteId)}
                  >
                    <div className={styles.voteTitle}>{vote.title}</div>
                    <div className={styles.voteMeta}>
                      <span className={`${styles.status} ${vote.isClosed ? styles.closed : styles.active}`}>
                        {vote.isClosed ? "종료됨" : "진행중"}
                      </span>
                      <span>{vote.createdAt}</span>
                      <span>작성자: {vote.authorName}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

      </div>

      <ModalPortal isOpen={showCreateModal}>
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>새 투표 만들기</h2>
            <form onSubmit={handleCreateVote} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>제목</label>
                <input
                  type="text"
                  value={voteForm.title}
                  onChange={(e) => setVoteForm({ ...voteForm, title: e.target.value })}
                  placeholder="투표 제목을 입력하세요"
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>투표 옵션</label>
                {voteForm.options.map((option, index) => (
                  <div key={index} className={styles.optionRow}>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`옵션 ${index + 1}`}
                      className={styles.input}
                      required
                    />
                    {voteForm.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className={styles.removeButton}
                        title="옵션 삭제"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addOption} className={styles.addOptionButton}>
                  + 옵션 추가
                </button>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={voteForm.isAnonymous}
                    onChange={(e) => setVoteForm({ ...voteForm, isAnonymous: e.target.checked })}
                    className={styles.checkbox}
                  />
                  익명 투표
                </label>
              </div>

              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowCreateModal(false)} className={styles.cancelButton}>
                  취소
                </button>
                <button type="submit" className={styles.submitButton}>
                  투표 만들기
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      <ModalPortal isOpen={showEditModal}>
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>투표 수정</h2>
            <form onSubmit={handleUpdateVote} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>제목</label>
                <input
                  type="text"
                  value={voteForm.title}
                  onChange={(e) => setVoteForm({ ...voteForm, title: e.target.value })}
                  placeholder="투표 제목을 입력하세요"
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>투표 옵션</label>
                {voteForm.options.map((option, index) => (
                  <div key={index} className={styles.optionRow}>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`옵션 ${index + 1}`}
                      className={styles.input}
                      required
                    />
                    {voteForm.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className={styles.removeButton}
                        title="옵션 삭제"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addOption} className={styles.addOptionButton}>
                  + 옵션 추가
                </button>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={voteForm.isAnonymous}
                    onChange={(e) => setVoteForm({ ...voteForm, isAnonymous: e.target.checked })}
                    className={styles.checkbox}
                  />
                  익명 투표
                </label>
              </div>

              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowEditModal(false)} className={styles.cancelButton}>
                  취소
                </button>
                <button type="submit" className={styles.submitButton}>
                  수정 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>

      <ModalPortal isOpen={showDetailModal}>
        <div className={styles.modalOverlay} onClick={() => setShowDetailModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {selectedVote && (
              <>
                {/* 상세 모달 헤더 */}
                <div className={styles.detailHeader}>
                  <div className={styles.authorInfo}>
                    <img
                      src={selectedVote.authorImageUrl || "/placeholder.svg"}
                      alt="avatar"
                      className={styles.avatar}
                    />
                    <div>
                      <div className={styles.authorName}>{selectedVote.authorName}</div>
                      <div className={styles.postDate}>
                        {format(parseISO(selectedVote.createdAt), 'yyyy년 MM월 dd일')}
                      </div>
                    </div>
                  </div>
                  <div className={styles.menuWrapper} onClick={(e) => e.stopPropagation()}>
                    {(selectedVote.authorId === currentUserId || isSubLeaderOrAbove()) && (
                      <button
                        className={styles.menuBtn}
                        onClick={() =>
                          setMenuVisible((prev) => ({
                            ...prev,
                            [selectedVote.voteId]: !prev[selectedVote.voteId],
                          }))
                        }
                        title="메뉴"
                      >
                        ⋯
                      </button>
                    )}
                    {menuVisible[selectedVote.voteId] && (
                      <div className={styles.menuList}>
                        {canEditVote(selectedVote) && (
                          <button
                            onClick={() => {
                              setMenuVisible((prev) => ({ ...prev, [selectedVote.voteId]: false }))
                              openEditModal({
                                voteId: selectedVote.voteId,
                                title: selectedVote.title,
                                isClosed: selectedVote.isClosed,
                                authorName: selectedVote.authorName,
                                authorId: selectedVote.authorId,
                                createdAt: selectedVote.createdAt,
                              })
                              setShowDetailModal(false)
                            }}
                            disabled={selectedVote.isClosed}
                          >
                            수정하기
                          </button>
                        )}
                        {canDeleteVote(selectedVote) && (
                          <button
                            onClick={() => {
                              setMenuVisible((prev) => ({ ...prev, [selectedVote.voteId]: false }))
                              handleDeleteVote(selectedVote.voteId)
                            }}
                          >
                            삭제하기
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <h2 className={styles.modalTitle}>{selectedVote.title}</h2>
                <div className={styles.detailMeta}>
                  <span className={`${styles.status} ${selectedVote.isClosed ? styles.closed : styles.active}`}>
                    {selectedVote.isClosed ? "종료됨" : "진행중"}
                  </span>
                  <span>{selectedVote.isAnonymous ? "익명 투표" : "공개 투표"}</span>
                </div>

                {loadingDetail ? (
                  <div className={styles.loading}>투표 정보를 불러오는 중...</div>
                ) : (
                  <div className={styles.optionList}>
                    {selectedVote.options.map((option) => {
                      const totalVotes = selectedVote.options.reduce((sum, opt) => sum + opt.voteCount, 0)
                      const percentage = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0

                      return (
                        <div key={option.voteOptionId} className={styles.optionItem}>
                          <div className={styles.optionHeader}>
                            <span className={styles.optionName}>{option.voteOptionName}</span>
                            <span className={styles.voteCount}>
                              {option.voteCount}표 ({percentage.toFixed(1)}%)
                            </span>
                          </div>

                          <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: `${percentage}%` }} />
                          </div>

                          {!selectedVote.isAnonymous && option.voterName.length > 0 && (
                            <div className={styles.voterList}>
                              <strong>투표자:</strong> {option.voterName.join(", ")}
                            </div>
                          )}

                          {!selectedVote.isClosed && (
                            <button
                              onClick={() => handleSubmitVote(option.voteOptionId)}
                              disabled={submittingVote}
                              className={styles.voteButton}
                            >
                              {submittingVote ? "투표 중..." : "투표하기"}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className={styles.modalActions}>
                  <button onClick={() => setShowDetailModal(false)} className={styles.cancelButton}>
                    닫기
                  </button>
                  {!selectedVote.isClosed && canCloseVote(selectedVote) && (
                    <button onClick={handleCloseVote} className={styles.closeVoteButton}>
                      투표 종료
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </ModalPortal>
    </>
  )
}
