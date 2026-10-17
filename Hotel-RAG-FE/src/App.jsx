// File: src/App.jsx
import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Header from "./components/Header";
import Footer from "./components/Footer";
import AIChatWidget from "./components/AIChatWidget";

// Pages
import Home from "./pages/Home";
import Hotels from "./pages/Hotels";
import HotelDetail from "./pages/HotelDetail";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import PartnerApplication from "./pages/PartnerApplication"; // <- MỚI
import PartnerDashboard from "./pages/PartnerDashboard"; // <- MỚI
import AdminDashboard from "./pages/AdminDashboard"; // <- MỚI
import ProtectedRoute from "./components/ProtectedRoute"; // <- MỚI

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const handleLogout = () => setLoggedIn(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#fffdf9] text-stone-800 flex flex-col relative">
        <Header loggedIn={loggedIn} onLogout={handleLogout} />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/hotels" element={<Hotels />} />
            <Route path="/hotels/:id" element={<HotelDetail />} />

            <Route
              path="/login"
              element={
                <AuthPage mode="login" onSuccess={() => setLoggedIn(true)} />
              }
            />
            <Route
              path="/register"
              element={
                <AuthPage mode="register" onSuccess={() => setLoggedIn(true)} />
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage onLogout={handleLogout} />
                </ProtectedRoute>
              }
            />

            {/* Bất kỳ ai đăng nhập cũng có thể gửi đơn xin làm đối tác */}
            <Route
              path="/partner-apply"
              element={
                <ProtectedRoute>
                  <PartnerApplication />
                </ProtectedRoute>
              }
            />

            {/* CHỈ PARTNER (hoặc Admin) mới vào được màn hình quản lý khách sạn */}
            <Route
              path="/partner"
              element={
                <ProtectedRoute allowedRoles={["Partner", "Admin"]}>
                  <PartnerDashboard />
                </ProtectedRoute>
              }
            />

            {/* CHỈ ADMIN MỚI VÀO ĐƯỢC KHU VỰC DUYỆT */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["Admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        <Footer />
        <AIChatWidget />
      </div>
    </BrowserRouter>
  );
}
