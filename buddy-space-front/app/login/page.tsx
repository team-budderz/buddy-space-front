'use client';
import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const passwordReagex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!passwordReagex.test(password)) {
            setError(
                "비밀번호 형식이 올바르지 않습니다. (8자 이상, 대소문자 포함, 숫자 및 특수문자(@$!%*?&#) 포함)"
            );
            return;
        }

        try {
            //백엔드 로그인 API 호출
            const res = await axios.post("http://localhost:8080/api/users/login", { email, password, });

            localStorage.setItem("token", res.data.token);

            router.push("/meeting");
        } catch (error) {
            alert("로그인 실패 : 이메일 또는 비밀번호를 확인하세요.");
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p style={{ color: "red" }}>{error}</p>}
            <button type="submit">로그인</button>
        </form>
    )
}