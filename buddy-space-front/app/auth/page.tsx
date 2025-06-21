'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export const useAuth = () => {
  const router = useRouter();


  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  }, [router]);

 
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) return null;

      const res = await fetch('http://localhost:8080/api/token/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      });

      if (!res.ok) return null;

      const data = await res.json();
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      return data.data.accessToken;
    } catch (error) {
      console.error('refreshAccessToken error:', error);
      return null;
    }
  }, []);


  const authFetch = useCallback(
    async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
      let accessToken = localStorage.getItem('accessToken');
      const headers = new Headers(init?.headers || {});
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }

      let response = await fetch(input, { ...init, headers });

      if (response.status === 401) {
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          headers.set('Authorization', `Bearer ${newAccessToken}`);
          response = await fetch(input, { ...init, headers });
        } else {
          // 토큰 갱신 실패하면 로그아웃 처리
          logout();
          throw new Error('로그인 세션 만료');
        }
      }

      return response;
    },
    [logout, refreshAccessToken]
  );

  return { authFetch, logout };
};
