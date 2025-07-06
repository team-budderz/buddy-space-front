import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL!;

export interface ReissueResult {
  accessToken: string;
}

// ————— 토큰 재발급 헬퍼 —————
// 클라이언트에 저장된 refreshToken(또는 쿠키)을 이용해서 재발급만 담당
export async function reissueToken(): Promise<ReissueResult> {
  try {
    console.debug("[Token] 재발급 요청 시작");

    const res = await axios.post(
      `${baseURL}/token/refresh`,
      {},                   // body 없이
      { withCredentials: true }
    );

    console.debug("[Token] 재발급 응답:", res.data);

    return res.data.result as ReissueResult;
  } catch (e: any) {
    console.error(
      "[Token] 재발급 실패:",
      e.response?.status,
      e.response?.data || e.message
    );
    throw e;
  }
}


const api = axios.create({
  baseURL,
  withCredentials: true,
});

// ————— 요청 인터셉터 —————
api.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete config.headers?.["Content-Type"];
    }
    console.debug("[API → ]", config.method?.toUpperCase(), config.url, "헤더:", config.headers);
    const raw = localStorage.getItem("accessToken") || "";
    const token = raw.replace(/^"|"$/g, "").replace(/^Bearer\s*/, "");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error("[API → ERROR]", error);
    return Promise.reject(error);
  }
);

// ————— 응답 인터셉터 —————
api.interceptors.response.use(
  res => res,
  async err => {
    const original: any = err.config;
    const status = err.response?.status;

    if (status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { accessToken } = await reissueToken();

        localStorage.setItem("accessToken", accessToken);

        // 헤더 갱신 후 재요청
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        // 재발급 실패 시
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
        return Promise.reject(err);
      }
    }

    return Promise.reject(err);
  }
);


export default api;
