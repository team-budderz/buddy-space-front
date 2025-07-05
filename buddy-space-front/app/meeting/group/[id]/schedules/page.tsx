'use client';

import React, { useState, useEffect } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  parseISO,
} from 'date-fns';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import styles from './schedules.module.css';
import api from '@/app/api';
import { useGroupPermissions } from '../layout';
import { useParams } from 'next/navigation';
import { ko } from 'date-fns/locale'
import { registerLocale } from 'react-datepicker';
import { usePermissionChecker } from '../layout';


registerLocale('ko', ko);

interface Schedule {
  id: number;
  title: string;
  description: string;
  start: Date;
  end: Date;
  authorName: string;
}

interface ScheduleDetail {
  id: number;
  title: string;
  content: string;
  startAt: string;
  endAt: string;
  authorId: number;
  authorName: string;
  authorImageUrl: string | null;
  createdAt: string;
}

import { createPortal } from "react-dom"

// ModalPortal 컴포넌트 추가
function ModalPortal({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted || !isOpen) return null

  return createPortal(children, document.body)
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [formData, setFormData] = useState({ title: '', description: '', start: new Date(), end: new Date() });
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const { getCurrentUserId } = useGroupPermissions();
  const currentUserId = getCurrentUserId();
  const [detailData, setDetailData] = useState<ScheduleDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const { canCreateSchedule, canDeleteSchedule } = usePermissionChecker();

  const params = useParams();
  const groupId = params.id as string;

  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyInfo = async () => {
      try {
        const res = await api.get("/users/me");
        setCurrentUserName(res.data.result.name); // username or name
      } catch (err) {
        console.error("내 정보 불러오기 실패:", err);
      }
    };
    fetchMyInfo();
  }, []);

  // 월별 일정 조회
  const fetchMonthlySchedules = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const res = await api.get(`/groups/${groupId}/schedules?year=${year}&month=${month}`);
      const list = res.data.result.map((s: any) => ({
        id: s.scheduleId,
        title: s.title,
        description: s.content,
        start: parseISO(s.startAt),
        end: parseISO(s.endAt),
        authorName: s.authorName,
      }));
      setSchedules(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchMonthlySchedules(); }, [currentDate, groupId]);

  const showDetail = async (scheduleId: number) => {
    try {
      const res = await api.get(`/groups/${groupId}/schedules/${scheduleId}`);
      const data = res.data.result;

      setDetailData(data);
      setSelectedScheduleId(scheduleId);
      setDetailVisible(true);
    } catch (err) {
      console.error(err);
    }
  };


  const getUserIdFromName = async (authorName: string): Promise<number | null> => {
    try {
      const res = await api.get(`/groups/${groupId}/members`);
      const member = res.data.result.find((m: any) => m.name === authorName);
      return member ? member.id : null;
    } catch (err) {
      console.error('이름으로 유저 ID 조회 실패:', err);
      return null;
    }
  };


  // 수정 
  const openEditModal = async (scheduleId: number) => {
    try {
      const res = await api.get(`/groups/${groupId}/schedules/${scheduleId}`);
      const s = res.data.result;
      setFormData({ title: s.title, description: s.content, start: parseISO(s.startAt), end: parseISO(s.endAt) });
      setSelectedScheduleId(scheduleId);
      setIsEditing(true);
      setModalVisible(true);
      setDetailVisible(false);
    } catch (err) {
      console.error(err);
    }
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setDetailData(null);
    setMenuVisible(false);
  };


  // 삭제
  const handleDelete = async (scheduleId: number) => {
    const raw = localStorage.getItem('accessToken');
    const token = raw?.replace(/^"|"$/g, '');
    if (!token) {
      console.warn('토큰이 없습니다. 로그인 상태를 확인하세요.');
      return;
    }
    try {
      await api.delete(
        `/groups/${groupId}/schedules/${scheduleId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchMonthlySchedules();
      closeDetail();
    } catch (err) {
      console.error(err);
    }
  };

  // 생성
  const handleAdd = async () => {
    const raw = localStorage.getItem('accessToken') || '';
    const token = raw.replace(/^"|"$/g, '');
    if (!token) {
      console.warn('토큰이 없습니다.');
      return;
    }
    try {
      const body = {
        title: formData.title,
        content: formData.description,
        startAt: formData.start.toISOString(),
        endAt: formData.end.toISOString(),
      };
      await api.post(
        `/groups/${groupId}/schedules`,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchMonthlySchedules();
      closeModal();
    } catch (err) {
      console.error('생성 실패:', err);
    }
  };

  // 수정
  const handleUpdate = async () => {
    if (selectedScheduleId == null) return;
    const raw = localStorage.getItem('accessToken') || '';
    const token = raw.replace(/^"|"$/g, '');
    if (!token) {
      console.warn('토큰이 없습니다.');
      return;
    }
    try {
      const body = {
        title: formData.title,
        content: formData.description,
        startAt: formData.start.toISOString(),
        endAt: formData.end.toISOString(),
      };
      await api.put(
        `/groups/${groupId}/schedules/${selectedScheduleId}`,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchMonthlySchedules();
      closeModal();
    } catch (err) {
      console.error('수정 실패:', err);
    }
  };


  const openModalForCreate = () => {
    setFormData({ title: '', description: '', start: new Date(), end: new Date() });
    setIsEditing(false);
    setModalVisible(true);
    setDetailVisible(false);
  };
  const closeModal = () => {
    setModalVisible(false);
    setSelectedScheduleId(null);
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    isEditing ? await handleUpdate() : await handleAdd();
  };
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = new Date();

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.calendarHeader}>
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}>{'<'}</button>
        <h2>{format(currentDate, 'yyyy년 MM월')}</h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}>{'>'}</button>
        <button onClick={() => setCurrentDate(new Date())}>오늘</button>
        {canCreateSchedule() && (
          <button className={styles.createBtn} onClick={openModalForCreate}>
            일정 만들기
          </button>
        )}
      </div>

      <div className={styles.calendarGrid}>
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => <div key={d} className={`${styles.dayLabel} ${i === 0 ? styles.sundayLabel : i === 6 ? styles.saturdayLabel : ''}`}>{d}</div>)}
        {days.map((day, i) => (
          <div key={i} className={`${styles.dayCell} ${day.getDay() === 0 ? styles.sundayCell : day.getDay() === 6 ? styles.saturdayCell : ''}`}>
            <div className={`${styles.dayNumber} ${isSameDay(today, day) ? styles.today : ''}`}>{day.getDate()}</div>
            {schedules.filter(s => day >= s.start && day <= s.end).map((evt, j) => (
              <div key={j} className={styles.eventBar} onClick={() => showDetail(evt.id)}>{evt.title}</div>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.scheduleList}>
        {schedules.map((s) => (
          <div
            key={s.id}
            className={styles.scheduleItem}
            onClick={() => showDetail(s.id)}
          >
            <h4>{s.title}</h4>
            <p>
              {format(s.start, 'yyyy.MM.dd')} ~ {format(s.end, 'yyyy.MM.dd')}
            </p>
            <p>작성자: {s.authorName}</p>
          </div>
        ))}
      </div>

      <ModalPortal isOpen={detailVisible}>
        {detailData && (
          <div className={styles.modalOverlay} onClick={closeDetail}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div className={styles.detailHeader}>
                <div className={styles.authorInfo}>
                  <img
                    src={detailData.authorImageUrl || '/avatar.png'}
                    alt="avatar"
                    className={styles.avatar}
                  />
                  <div>
                    <div className={styles.authorName}>{detailData.authorName}</div>
                    <div className={styles.postDate}>
                      {format(parseISO(detailData.createdAt), 'yyyy년 MM월 dd일')}
                    </div>
                  </div>
                </div>
                {(detailData.authorName === currentUserName || canDeleteSchedule()) && (
                  <div className={styles.menuWrapper}>
                    <button
                      className={styles.menuBtn}
                      onClick={() => setMenuVisible(v => !v)}
                    >
                      ⋮
                    </button>
                    {menuVisible && (
                      <div className={styles.menuList}>
                        {/* 작성자만 보이는 수정 버튼 */}
                        {detailData.authorName === currentUserName && (
                          <button onClick={() => selectedScheduleId && openEditModal(selectedScheduleId)}>
                            수정하기
                          </button>
                        )}
                        {/* 작성자이거나 권한(리더·부리더)이 있으면 보이는 삭제 버튼 */}
                        <button onClick={() => selectedScheduleId && handleDelete(selectedScheduleId)}>
                          삭제하기
                        </button>
                      </div>
                    )}
                  </div>
                )}


              </div>

              <div className={styles.detailBody}>
                <h3>기간 </h3>
                <div className={styles.detailDates}>
                  {format(parseISO(detailData.startAt), 'yyyy.MM.dd HH:mm')} ~{' '}
                  {format(parseISO(detailData.endAt), 'yyyy.MM.dd HH:mm')}
                </div>
                <h3 className={styles.detailTitle}>일정 : {detailData.title}</h3>
                <div className={styles.detailContent}>{detailData.content}</div>
              </div>
            </div>
          </div>
        )}
      </ModalPortal>

      <ModalPortal isOpen={modalVisible}>
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ textAlign: 'center', marginBottom: 16 }}>
              {isEditing ? '일정 수정하기' : '일정 만들기'}
            </h3>

            <div className={styles.formRow}>
              <label>제목</label>
              <input
                className={styles.simpleInput}
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className={styles.formRow}>
              <label>설명</label>
              <textarea
                className={styles.simpleTextArea}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className={styles.formRow}>
              <label>시작</label>
              <div className={styles.dateTimeWrapper}>
                <DatePicker
                  selected={formData.start}
                  onChange={d => setFormData({ ...formData, start: d as Date })}
                  locale="ko"
                  dateFormat="yyyy.MM.dd"
                  className={styles.simpleDateInput}
                />
                <DatePicker
                  selected={formData.start}
                  onChange={d => setFormData({ ...formData, start: d as Date })}
                  locale="ko"
                  showTimeSelect
                  showTimeSelectOnly
                  timeIntervals={30}
                  dateFormat="aa h:mm"
                  timeCaption="시간"
                  className={styles.simpleTimeSelect}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <label>끝</label>
              <div className={styles.dateTimeWrapper}>
                <DatePicker
                  selected={formData.end}
                  onChange={d => setFormData({ ...formData, end: d as Date })}
                  locale="ko"
                  dateFormat="yyyy.MM.dd"
                  className={styles.simpleDateInput}
                />
                <DatePicker
                  selected={formData.end}
                  onChange={d => setFormData({ ...formData, end: d as Date })}
                  locale="ko"
                  showTimeSelect
                  showTimeSelectOnly
                  timeIntervals={30}
                  dateFormat="aa h:mm"
                  timeCaption="시간"
                  className={styles.simpleTimeSelect}
                />
              </div>
            </div>

            <div className={styles.modalActions}>
              <button onClick={handleSubmit}>
                {isEditing ? '수정 완료' : '등록 완료'}
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    </div >
  );
}
