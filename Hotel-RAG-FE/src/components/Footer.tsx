// File: src/components/Footer.jsx
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-[#102f28] py-10 text-white/60">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-5 text-sm sm:flex-row lg:px-8">
        <p><strong className="font-display text-lg text-white">Nestly</strong> · Chỗ ở đẹp, chuyến đi đáng nhớ.</p>
        <nav aria-label="Liên kết cuối trang" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link to="/hotels" className="inline-flex min-h-6 items-center hover:text-white">Khách sạn</Link>
          <Link to="/transfers" className="inline-flex min-h-6 items-center hover:text-white">Xe đưa đón</Link>
          <Link to="/partner-apply" className="inline-flex min-h-6 items-center hover:text-white">Trở thành đối tác</Link>
          <Link to="/transport-apply" className="inline-flex min-h-6 items-center hover:text-white">Đăng ký nhà xe</Link>
        </nav>
        <p>© 2026 Nestly Vietnam</p>
      </div>
    </footer>
  );
}