'use client';
import { useRouter } from 'next/navigation';
import styles from './homepage.module.css';
import Image from 'next/image';

export default function HomePage() {
  const router = useRouter();

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:8080/oauth2/authorization/google';
  };

    const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  };

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>벗터즈에 오신 걸 환영합니다!</h1>
      <div className={styles.buttonGroup}>
        <button onClick={() => router.push('/login')} className={styles.button}>
          로그인
        </button>
        <button onClick={() => router.push('/signup')} className={styles.button}>
          회원가입
        </button>
        <button onClick={() => router.push('/mission')} className={styles.button}>
          미션
        </button>
        <button onClick={() => router.push('/schedule')} className={styles.button}>
          일정
        </button>
        <button onClick={handleLogout} className={styles.button}>
          로그아웃
        </button>
      </div>

      <div onClick={handleGoogleLogin} style={{ cursor: 'pointer' }}>
        <Image
          src="/google.png"
          alt="Google Login"
          width={900}
          height={200}
        />
      </div>
    </main>
  );
}
