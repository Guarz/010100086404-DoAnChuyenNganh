// File: src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, allowedRoles }) {
  // 1. Kiểm tra xem đã đăng nhập chưa (đọc từ LocalStorage)
  const userStr = localStorage.getItem("nestly_user");
  const currentUser = userStr ? JSON.parse(userStr) : null;

  // KỊCH BẢN 1: Chưa đăng nhập -> Đá thẳng về trang /login
  // (replace = true để xóa lịch sử truy cập sai, khách bấm nút Back không bị kẹt)
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // KỊCH BẢN 2: Đã đăng nhập nhưng không đủ thẩm quyền (Sai Role)
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    alert("Bạn không có quyền truy cập khu vực này!");
    return <Navigate to="/" replace />; // Đá về Trang chủ
  }

  // KỊCH BẢN 3: Hợp lệ 100% -> Mở cửa cho vào trang yêu cầu
  return children;
}