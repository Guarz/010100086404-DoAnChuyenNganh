// File: src/services/api.js
import axios from "axios";

// Địa chỉ API đặt qua biến VITE_API_URL (vd. khi deploy); mặc định là backend chạy trên máy
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

// Tự động gắn Token vào Header
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("nestly_token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default API;