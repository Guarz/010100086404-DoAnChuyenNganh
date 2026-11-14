import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Tiêu đề tab trình duyệt theo từng trang (giúp người dùng nhiều tab và trình đọc màn hình)
const TITLES = [
  [/^\/$/, "Đặt phòng khách sạn & xe đưa đón"],
  [/^\/hotels\/[^/]+$/, "Chi tiết khách sạn"],
  [/^\/hotels/, "Tìm khách sạn"],
  [/^\/login/, "Đăng nhập"],
  [/^\/register/, "Tạo tài khoản"],
  [/^\/profile/, "Tài khoản của tôi"],
  [/^\/checkout/, "Thanh toán đặt phòng"],
  [/^\/payment/, "Kết quả thanh toán"],
  [/^\/transfers\/checkout/, "Thanh toán xe đưa đón"],
  [/^\/transfers/, "Xe đưa đón sân bay"],
  [/^\/partner-apply/, "Đăng ký đối tác khách sạn"],
  [/^\/transport-apply/, "Đăng ký nhà xe"],
  [/^\/partner/, "Trung tâm đối tác"],
  [/^\/transport/, "Trung tâm nhà xe"],
  [/^\/admin/, "Trung tâm quản trị"],
];

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Ép thanh cuộn về tọa độ x:0, y:0 ngay lập tức khi pathname thay đổi
    window.scrollTo(0, 0);
    const title = TITLES.find(([re]) => re.test(pathname))?.[1];
    document.title = title ? `${title} | Nestly` : "Nestly";
  }, [pathname]);

  return null;
}
