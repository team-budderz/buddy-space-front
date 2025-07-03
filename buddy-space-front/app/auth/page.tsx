import axios from "axios"

const api = axios.create({
  baseURL: "http://localhost:8080/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.request.use((config) => {
  console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`)

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken") || localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  return config
})

api.interceptors.response.use(
  (response) => {
    console.log(` ${response.status}`)
    return response
  },
  (error) => {
    console.error(` ${error.response?.status || "Network Error"}`)
    console.error("Error details:", error.response?.data || error.message)
    return Promise.reject(error)
  },
)

export default api
