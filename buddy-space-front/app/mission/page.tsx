'use client';

import { useForm } from 'react-hook-form';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './mission.css'
import { useState } from 'react';

type FormValues = {
  title: string;
  description: string;
  startDate: Date | null;
  endDate: Date | null;
};

export default function MissionRegisterPage() {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>();

  const onSubmit = (data: FormValues) => {
    console.log('제출됨:', data);
    // TODO: API 연동
  };

  // 실시간으로 입력된 날짜 정보 가져오기
  const startDate = watch('startDate');
  const endDate = watch('endDate');

  return (
    <div className="mission-container">
      <h1 className="mission-title">미션 등록</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mission-form">
        <div className="form-group">
          <label>미션 제목</label>
          <input
            type="text"
            {...register('title', { required: '제목은 필수입니다.' })}
          />
          {errors.title && <p className="error">{errors.title.message}</p>}
        </div>

        <div className="form-group">
          <label>미션 설명</label>
          <textarea {...register('description')} />
        </div>

        <div className="form-group">
          <label>시작 일시</label>
          <DatePicker
            selected={startDate} // 현재 선택된 날짜 값
            onChange={(date) => setValue('startDate', date)}
            showTimeSelect
            dateFormat="Pp"
            placeholderText="날짜 선택"
          />
        </div>

        <div className="form-group">
          <label>종료 일시</label>
          <DatePicker
            selected={endDate}
            onChange={(date) => setValue('endDate', date)}
            showTimeSelect
            dateFormat="Pp"
            placeholderText="날짜 선택"
            minDate={startDate || new Date()}
          />
        </div>

        <div className="button-group">
            {/*취소 버튼을 누르면 초기화*/}
          <button type="button" onClick={() => reset()}>취소</button>
          <button type="submit" className="submit-btn">등록</button>
        </div>
      </form>
    </div>
  );
}
