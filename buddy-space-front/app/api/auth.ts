export const getAuthHeaders = () => {
  if (typeof window === "undefined") {
    return {}
  }
  const token = localStorage.getItem("accessToken") || localStorage.getItem("token")
  if (!token) {
    return {}
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}
