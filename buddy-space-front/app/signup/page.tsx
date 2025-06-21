'use client';
import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from 'next/navigation';

export default function SignupPage() {

    useEffect(() => {
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.body.appendChild(script);
    }, []);

    const router = useRouter();
    const [form, setForm] = useState({
        name: "",           // 이름
        email: "",          // 이메일
        password: "",       //비밀번호
        birthDate: "",      // 생년월일
        gender: "",         // 성별
        address: "",        // 주소
        phone: "",          // 전화번호호
    });

    const [errors, setErrors] = useState({ // 이름, 이메일, 비밀번호, 전화번호 에러메세지
        name: "", 
        email: "",
        password: "",
        phone: "",
    })

    const [serverMessage, setServerMessage] = useState("");

    // 입력값 유효성 검사 이름이랑 이메일 비밀번호 전화번호 형식에 맞게 쓰게 하도록 그리고 백엔드에서 설정한 유효성 검사를 가져와서 연결하고 싶었지만 그건 안됨 그래서 프론트랑 백엔드 둘다 유효성 검사를 작섣해야해
    const regex = {
        name: /^[a-zA-Z가-힣]+$/,
        email: /^[\w!#$%&'*+/=?`{|}~^.-]+@[\w.-]+\.[a-zA-Z]{2,6}$/,
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/,
        phone: /^\d{2,3}-\d{3,4}-\d{4}$/,
    };

    // 유효성 실시간 검사
    const validateField = (name: string, value: string) => {
        let error = "";
        if (name === "name" && !regex.name.test(value)) {
            error = "이름은 한글 또는 영문만 입력 가능합니다.";
        }
        if (name === "email" && !regex.email.test(value)) {
            error = "이메일 형식이 올바르지 않습니다.";
        }
        if (name === "password" && !regex.password.test(value)) {
            error =
                "비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다.";
        }
        if (name === "phone" && !regex.phone.test(value)) {
            error = "전화번호는 010-1234-5678 형식으로 입력해주세요.";
        }
        setErrors((prev) => ({ ...prev, [name]: error }));
    };

    // 주소 검색
    const handleAddressSearch = () => {
        new (window as any).daum.Postcode({
            oncomplete: function (data: any) {
                const jibunAddress = data.jibunAddress;
                const {sido, sigungu, bname} = data;

                const selectedAddress = jibunAddress || `${sido} ${sigungu} ${bname}`;
                setForm((prev) => ({...prev, address: selectedAddress}));
            },
        }).open();
    }

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
        
        if (["name", "email", "password", "phone"].includes(name)) {
            validateField(name, value);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const hasErrors = Object.values(errors).some((msg) => msg);
        if (hasErrors) {
            setServerMessage("입력값을 다시 확인해주세요.");
            return;
        }

        try { // 백엔드에 회원가입 POST 요청
            await axios.post("http://localhost:8080/api/users/signup", { ...form, });
            setServerMessage("회원가입 성공 로그인 페이지로 이동합니다."); // 회원가입 성공시 로그인 페이지로 이동
            setTimeout(() => router.push("/login"), 1500);
        } catch (error) { // 회원가입 실패시 에러
            setServerMessage("회원가입 실패: " + ((error as any).response?.data?.message || "에러 발생")
            );
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: "0 auto" }}>
            <h2>회원가입</h2>

            <input type="text" name="name" placeholder="이름" value={form.name} onChange={handleChange} required />
            {errors.name && <p style={{ color: "red" }}>{errors.name}</p>}
            <input type="email" name="email" placeholder="이메일" value={form.email} onChange={handleChange} required />
            {errors.email && <p style={{ color: "red" }}>{errors.email}</p>}
            <input type="password" name="password" placeholder="비밀번호" value={form.password} onChange={handleChange} required />
            {errors.password && <p style={{ color: "red" }}>{errors.password}</p>}
            <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange} required />
            <select name="gender" value={form.gender} onChange={handleChange} required>
                <option value="">성별 선택</option>
                <option value="M">남성</option>
                <option value="F">여성</option>
            </select>
            <div style={{ display: "flex", gap: "0.5rem" }}>
                <input type="text" name="address" placeholder="주소" value={form.address} onChange={handleChange} readOnly required style={{ flex: 1 }} />
                <button type="button" onClick={handleAddressSearch}>주소 검색</button>
            </div>
            <input type="tel" name="phone" placeholder="전화번호" value={form.phone} onChange={handleChange} required />
            {errors.phone && <p style={{ color: "red" }}>{errors.phone}</p>}
            <button type="submit">가입하기</button>
            {serverMessage && <p style={{ marginTop: "1rem" }}>{serverMessage}</p>}
        </form>
    );
}
