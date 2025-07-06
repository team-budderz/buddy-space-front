import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL!;

// ————— 토큰 재발급 헬퍼 —————
// 클라이언트에 저장된 refreshToken(또는 쿠키)을 이용해서 재발급만 담당
export async function reissueToken() {
  try {
    console.debug("[Token] 재발급 요청 시작");

    const res = await axios.post(
      `${baseURL}/token/refresh`,
      {}, // body 없이
      { withCredentials: true } 
    );

    console.debug("[Token] 재발급 응답:", res.data);
    return res.data.result; // { accessToken }
  } catch (e: any) {
    console.error("[Token] 재발급 실패:", e.response?.status, e.response?.data || e.message);
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
  (res) => {
    console.debug("[API ← ]", res.config.method?.toUpperCase(), res.config.url, res.status);
    return res;
  },
  async (err: any) => {
    const original: any = err.config;
    const status = err.response?.status;
    console.error(`[API ← ERROR] ${original.method?.toUpperCase()} ${original.url} → ${status}`, err.response?.data);

    if (status === 401 && !original._retry) {
      original._retry = true;
      try {

        // refreshToken 기반 재발급
        const { accessToken, refreshToken } = await reissueToken();

        // 새 토큰 저장
        localStorage.setItem("accessToken", accessToken);

        console.debug("[API] 401 재시도: 새 accessToken 적용 후 재요청");
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshError) {
        console.error("[API] 재발급 중 에러:", refreshError);
        // 재발급 실패 시
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(err);
      }
    }

    return Promise.reject(err);
  }
);


export default api;
