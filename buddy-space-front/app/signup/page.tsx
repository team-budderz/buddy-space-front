"use client"

import type React from "react"

import { useEffect, useState } from "react"
import axios from "axios"
import { useRouter } from "next/navigation"
import styles from "./signup.module.css"
import Link from "next/link"

export default function SignupPage() {
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
    script.async = true
    document.body.appendChild(script)
  }, [])

  const router = useRouter()
  const [form, setForm] = useState({
    name: "", // 이름
    email: "", // 이메일
    password: "", // 비밀번호
    birthDate: "", // 생년월일
    gender: "", // 성별
    address: "", // 주소
    phone: "", // 전화번호
  })

  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  })

  const [serverMessage, setServerMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error" | "">("")

  // 입력값 유효성 검사
  const regex = {
    name: /^[a-zA-Z가-힣]+$/,
    email: /^[\w!#$%&'*+/=?`{|}~^.-]+@[\w.-]+\.[a-zA-Z]{2,6}$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,
    phone: /^\d{2,3}-\d{3,4}-\d{4}$/,
  }

  // 유효성 실시간 검사
  const validateField = (name: string, value: string) => {
    let error = ""
    if (name === "name" && !regex.name.test(value)) {
      error = "이름은 한글 또는 영문만 입력 가능합니다."
    }
    if (name === "email" && !regex.email.test(value)) {
      error = "이메일 형식이 올바르지 않습니다."
    }
    if (name === "password" && !regex.password.test(value)) {
      error = "비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다."
    }
    if (name === "phone" && !regex.phone.test(value)) {
      error = "전화번호는 010-1234-5678 형식으로 입력해주세요."
    }
    setErrors((prev) => ({ ...prev, [name]: error }))
  }

  // 주소 검색
  const handleAddressSearch = () => {
    ;new (window as any).daum.Postcode({
      oncomplete: (data: any) => {
        const jibunAddress = data.jibunAddress
        const { sido, sigungu, bname } = data

        const selectedAddress = jibunAddress || `${sido} ${sigungu} ${bname}`
        setForm((prev) => ({ ...prev, address: selectedAddress }))
      },
    }).open()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })

    if (["name", "email", "password", "phone"].includes(name)) {
      validateField(name, value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const hasErrors = Object.values(errors).some((msg) => msg)
    if (hasErrors) {
      setServerMessage("입력값을 다시 확인해주세요.")
      setMessageType("error")
      return
    }

    try {
      await axios.post("http://localhost:8080/api/users/signup", { ...form })
      setServerMessage("회원가입 성공! 로그인 페이지로 이동합니다.")
      setMessageType("success")
      setTimeout(() => router.push("/login"), 1500)
    } catch (error) {
      setServerMessage("회원가입 실패: " + ((error as any).response?.data?.message || "에러 발생"))
      setMessageType("error")
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        <h1 className={styles.title}>회원가입</h1>
        <p className={styles.subtitle}>계정을 생성하여 서비스를 이용하세요</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.label}>
              이름
            </label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="이름을 입력하세요"
              value={form.name}
              onChange={handleChange}
              className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
              required
            />
            {errors.name && <p className={styles.errorText}>{errors.name}</p>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              이메일
            </label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="이메일을 입력하세요"
              value={form.email}
              onChange={handleChange}
              className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
              required
            />
            {errors.email && <p className={styles.errorText}>{errors.email}</p>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              비밀번호
            </label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="비밀번호를 입력하세요"
              value={form.password}
              onChange={handleChange}
              className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
              required
            />
            {errors.password && <p className={styles.errorText}>{errors.password}</p>}
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="birthDate" className={styles.label}>
                생년월일
              </label>
              <input
                type="date"
                id="birthDate"
                name="birthDate"
                value={form.birthDate}
                onChange={handleChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="gender" className={styles.label}>
                성별
              </label>
              <select
                id="gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className={styles.select}
                required
              >
                <option value="">선택하세요</option>
                <option value="M">남성</option>
                <option value="F">여성</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="address" className={styles.label}>
              주소
            </label>
            <div className={styles.addressGroup}>
              <input
                type="text"
                id="address"
                name="address"
                placeholder="주소를 검색하세요"
                value={form.address}
                onChange={handleChange}
                className={styles.addressInput}
                readOnly
                required
              />
              <button type="button" onClick={handleAddressSearch} className={styles.addressButton}>
                검색
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="phone" className={styles.label}>
              전화번호
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              placeholder="010-1234-5678"
              value={form.phone}
              onChange={handleChange}
              className={`${styles.input} ${errors.phone ? styles.inputError : ""}`}
              required
            />
            {errors.phone && <p className={styles.errorText}>{errors.phone}</p>}
          </div>

          {serverMessage && <div className={`${styles.message} ${styles[messageType]}`}>{serverMessage}</div>}

          <button type="submit" className={styles.submitButton}>
            가입하기
          </button>
        </form>

        <div className={styles.loginLink}>
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </div>
      </div>
    </div>
  )
}
