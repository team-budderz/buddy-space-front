import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Dashboard() {
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if(!token) {
            router.replace("/login");
        }
    }, []);

    return <div>로그인하셔야 합니다.</div>
}