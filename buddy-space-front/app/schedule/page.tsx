// app/schedule/page.tsx
'use client';

import { useState } from 'react';
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
} from 'date-fns';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './schedule.css';

interface Schedule {
  title: string;
  description: string;
  start: Date;
  end: Date;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start: new Date(),
    end: new Date(),
  });

  const handleAddSchedule = () => {
    setSchedules([...schedules, { ...formData }]);
    setFormData({ title: '', description: '', start: new Date(), end: new Date() });
    setFormVisible(false);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const today = new Date();

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}>{'<'}</button>
        <h2>{format(currentDate, 'yyyy년 MM월')}</h2>
        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}>{'>'}</button>
        <button onClick={() => setCurrentDate(new Date())}>오늘</button>
        <button className="create-btn" onClick={() => setFormVisible(!formVisible)}>
          <span style={{ color: 'black' }}>일정 만들기</span>
        </button>
      </div>

      {formVisible && (
        <div className="schedule-form">
          <h3>일정 만들기</h3>
          <input
            type="text"
            placeholder="제목"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <textarea
            placeholder="설명"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="date-row">
            <label>시작</label>
            <DatePicker
              selected={formData.start}
              onChange={(date) => setFormData({ ...formData, start: date as Date })}
              showTimeSelect
              dateFormat="yyyy.MM.dd aa h:mm"
            />
            <label>끝</label>
            <DatePicker
              selected={formData.end}
              onChange={(date) => setFormData({ ...formData, end: date as Date })}
              showTimeSelect
              dateFormat="yyyy.MM.dd aa h:mm"
            />
          </div>
          <button onClick={handleAddSchedule}>완료</button>
        </div>
      )}

      <div className="calendar-grid">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d} className="day-label">{d}</div>
        ))}
        {days.map((day, i) => {
          const daySchedules = schedules.filter((s) => day >= s.start && day <= s.end);
          return (
            <div key={i} className="day-cell">
              <div className={`day-number ${isSameDay(today, day) ? 'today' : ''}`}>{day.getDate()}</div>
              {daySchedules.map((event, idx) => (
                <div key={idx} className="event-bar">{event.title}</div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="schedule-list">
        {schedules.map((s, i) => (
          <div key={i} className="schedule-item">
            <h4>{s.title}</h4>
            <p>{format(s.start, 'yyyy.MM.dd')} ~ {format(s.end, 'yyyy.MM.dd')}</p>
            <p>{s.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
