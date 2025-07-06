'use client'

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/app/api';
import styles from './search.module.css';

const groupTypeMap: Record<string,string> = {
  ONLINE: '온라인',
  OFFLINE: '오프라인',
  HYBRID: '온·오프라인',
}

const groupInterestMap: Record<string,string> = {
  HOBBY: '취미',
  FAMILY: '가족',
  SCHOOL: '학교',
  BUSINESS: '업무',
  EXERCISE: '운동',
  GAME: '게임',
  STUDY: '스터디',
  FAN: '팬',
  OTHER: '기타',
}

const interests = [
  { value: '', label: '전체' },
  { value: 'HOBBY', label: '취미' },
  { value: 'FAMILY', label: '가족' },
  { value: 'SCHOOL', label: '학교' },
  { value: 'BUSINESS', label: '업무' },
  { value: 'EXERCISE', label: '운동' },
  { value: 'GAME', label: '게임' },
  { value: 'STUDY', label: '스터디' },
  { value: 'FAN', label: '팬' },
  { value: 'OTHER', label: '기타' },
]

export default function SearchPage() {
  const params = useSearchParams()
  const keywordParam = params.get('keyword') || ''
  const interestParam = params.get('interest') || ''
  const pageParam = Number(params.get('page')) || 0

  const [keyword, setKeyword] = useState(keywordParam)
  const [interest, setInterest] = useState(interestParam)
  const [page, setPage] = useState(pageParam)

  const [groups, setGroups] = useState<any[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)

  const updateURL = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('keyword', keyword)
    if (interest) url.searchParams.set('interest', interest)
    else url.searchParams.delete('interest')
    if (page > 0) url.searchParams.set('page', String(page))
    else url.searchParams.delete('page')
    window.history.replaceState({}, '', url.toString())
  }

  const fetchGroups = async () => {
    if (!keyword.trim()) return
    setLoading(true)
    setError(null)
    try {
      let url = `/groups/search?keyword=${encodeURIComponent(keyword)}&page=${page}`
      if (interest) url += `&interest=${interest}`

      const res = await api.get(url)
      const data = res.data.result
      setGroups(data.content)
      setTotalPages(data.totalPages)
      setTotalElements(data.totalElements)
    } catch (e: any) {
      console.error(e)
      setError('검색 중 오류가 발생했습니다.')
      setGroups([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    updateURL()
    fetchGroups()
  }, [keyword, interest, page])

  const onFilterClick = (i: string) => {
    setInterest(i)
    setPage(0)
  }

  const renderPagination = () => {
    if (totalPages <= 1) return null
    const buttons = []
    const start = Math.max(0, page - 2)
    const end = Math.min(totalPages - 1, page + 2)

    const makeBtn = (label: string|number, p: number) => (
      <button
        key={`${label}-${p}`}
        className={`${styles['pagination-btn']} ${p === page ? styles['pagination-current'] : ''}`}
        onClick={() => setPage(p)}
      >
        {label}
      </button>
    )

    if (page > 0) buttons.push(makeBtn('‹ 이전', page - 1))
    if (start > 0) {
      buttons.push(makeBtn(1, 0))
      if (start > 1) buttons.push(<span key="dots1" className={styles['pagination-dots']}>…</span>)
    }
    for (let i = start; i <= end; i++) buttons.push(makeBtn(i + 1, i))
    if (end < totalPages - 1) {
      if (end < totalPages - 2) buttons.push(<span key="dots2" className={styles['pagination-dots']}>…</span>)
      buttons.push(makeBtn(totalPages, totalPages - 1))
    }
    if (page < totalPages - 1) buttons.push(makeBtn('다음 ›', page + 1))

    return <div className={styles['pagination-container']}>{buttons}</div>
  }

  return (
    <main className={styles['search-result-container']}>
      <header className={styles['search-header']}>
        {keyword
          ? <h1 id="keyword-display">"{keyword}" 검색 결과</h1>
          : <h1 id="keyword-display">검색어가 없습니다.</h1>}
        {totalElements > 0 && <p id="result-count">총 {totalElements}개의 모임을 찾았습니다</p>}
      </header>

      <section className={styles['interest-filter-container']}>
        <div className={styles['interest-filters']}>
          {interests.map((interestItem) => (
            <button
              key={interestItem.value}
              data-interest={interestItem.value}
              className={`${styles['interest-filter']} ${interest === interestItem.value ? styles.active : ''}`}
              onClick={() => onFilterClick(interestItem.value)}
            >
              {interestItem.label}
            </button>
          ))}
        </div>
      </section>

      {loading && (
        <div className={styles['loading-container']}>
          <div className={styles['loading-spinner']} />
          <div className={styles['loading-text']}>검색 중...</div>
        </div>
      )}

      {error && (
        <div className={styles.empty_state}>
          <div className={styles['empty-state-icon']}>⚠️</div>
          <h3>오류</h3>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <div className={styles.empty_state}>
          <div className={styles['empty-state-icon']}>🔍</div>
          <h3>"{keyword}"에 대한 검색 결과가 없습니다</h3>
          <p>다른 키워드로 검색해보시거나, 새로운 모임을 만들어보세요!</p>
        </div>
      )}

      <div className={styles['group-grid']}>
        {groups.map((group: any) => (
          <div key={group.groupId} className={styles['group-card']}>
            <img
              src={group.groupCoverImageUrl || 'https://via.placeholder.com/300x214?text=No+Image'}
              alt={group.groupName}
            />
            <div className={styles['group-info']}>
              <h3>{group.groupName}</h3>
              <div className={styles['group-meta']}>
                {groupTypeMap[group.groupType] || group.groupType} /
                {groupInterestMap[group.groupInterest] || group.groupInterest} ·
                멤버 {group.memberCount}명
              </div>
              {group.joinStatus !== 'APPROVED' ? (
                <button
                  className={styles['join-btn']}
                  disabled={group.joinStatus === 'REQUESTED'}
                  onClick={async () => {
                    try {
                      const res = await api.post(
                        `/groups/${group.groupId}/members/requests`
                      )
                      if (res.status === 200) {
                        setGroups(prevGroups =>
                          prevGroups.map(g =>
                            g.groupId === group.groupId ? { ...g, joinStatus: 'REQUESTED' } : g
                          )
                        )
                        alert('참여 요청이 완료되었습니다.')
                      }
                    } catch {
                      alert('참여 요청 중 오류가 발생했습니다.')
                    }
                  }}
                >
                  {group.joinStatus === 'REQUESTED' ? '가입 요청 중' : '참여하기'}
                </button>
              ) : (
                <div
                  onClick={() => window.location.href = `/group/main?id=${group.groupId}`}
                  style={{ cursor: 'pointer' }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {renderPagination()}
    </main>
  )
}