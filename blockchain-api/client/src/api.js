import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "/blockchain-api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosInstance.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      try {
        await axiosInstance.post("auth/users/logout");
      } catch (e) {
        console.warn("Auto-logout endpoint failed");
      }
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default axiosInstance;
