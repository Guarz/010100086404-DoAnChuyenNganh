import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Ép thanh cuộn về tọa độ x:0, y:0 ngay lập tức khi pathname thay đổi
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}