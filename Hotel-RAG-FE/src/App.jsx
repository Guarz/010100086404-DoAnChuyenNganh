// File: src/App.jsx
import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import ScrollToTop from "./components/ScrollToTop";
import Header from "./components/Header";
import Footer from "./components/Footer";
import AIChatWidget from "./components/AIChatWidget";

// Pages
import Home from "./pages/Home";
const Hotels = lazy(() => import("./pages/Hotels"));
const HotelDetail = lazy(() => import("./pages/HotelDetail"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const Checkout = lazy(() => import("./pages/Checkout"));
const VNPayReturn = lazy(() => import("./pages/VNPayReturn"));
const PartnerApplication = lazy(() => import("./pages/PartnerApplication"));
const PartnerDashboard = lazy(() => import("./pages/PartnerDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const RagAnalyticsDashboard = lazy(() => import("./pages/RagAnalyticsDashboard"));
import ProtectedRoute from "./components/ProtectedRoute"; // <- MỚI
const Transfers = lazy(() => import("./pages/Transfers"));
const TransferCheckout = lazy(() => import("./pages/TransferCheckout"));
const TransportApplication = lazy(() => import("./pages/TransportApplication"));
const TransportDashboard = lazy(() => import("./pages/TransportDashboard"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => {
    return !!localStorage.getItem("nestly_token");
  });
  const handleLogout = () => {
    localStorage.removeItem("nestly_token");
    localStorage.removeItem("nestly_user");
    setLoggedIn(false);
  };

  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="min-h-screen bg-[#fffdf9] text-stone-800 flex flex-col relative">
        <a href="#main-content" className="sr-only z-[100] rounded-xl bg-[#173b31] px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Bỏ qua tới nội dung chính
        </a>
        <Header loggedIn={loggedIn} onLogout={handleLogout} />

        <div id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          <Suspense fallback={<div role="status" className="grid min-h-[60vh] place-items-center font-bold text-[#173b31]">Đang tải...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/hotels" element={<Hotels />} />
            <Route path="/hotels/:id" element={<HotelDetail />} />
            <Route
              path="/login"
              element={
                // key riêng: chuyển /register <-> /login thì tạo mới AuthPage (không giữ trạng thái
                // "Kiểm tra hộp thư" của trang đăng ký khi đã sang trang đăng nhập)
                <AuthPage key="login" mode="login" onSuccess={() => setLoggedIn(true)} />
              }
            />
            <Route
              path="/register"
              element={
                <AuthPage key="register" mode="register" onSuccess={() => setLoggedIn(true)} />
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
            <Route
              path="/checkout/:id"
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              }
            />
            <Route path="/payment/vnpay-return" element={<VNPayReturn />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Xe đưa đón: khách tìm xe công khai, đặt/ thanh toán cần đăng nhập */}
            <Route path="/transfers" element={<Transfers />} />
            <Route
              path="/transfer-checkout/:id"
              element={
                <ProtectedRoute>
                  <TransferCheckout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transport-apply"
              element={
                <ProtectedRoute>
                  <TransportApplication />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transport"
              element={
                <ProtectedRoute allowedRoles={["Transport"]}>
                  <TransportDashboard />
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
            <Route
              path="/admin/rag"
              element={
                <ProtectedRoute allowedRoles={["Admin"]}>
                  <RagAnalyticsDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
          </Suspense>
        </div>
        <Footer />
        <AIChatWidget />
      </div>
    </BrowserRouter>
  );
}
