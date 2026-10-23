// File: src/components/Header.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "./Icon"; // Hoặc "../common/Icon" tùy thư mục của bạn

// Hàm hỗ trợ tạo Avatar từ Tên (Lấy 2 chữ cái đầu của 2 từ cuối)
const getInitials = (name) => {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function Header({ loggedIn, onLogout }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  
  // Lấy thông tin user từ LocalStorage
  const userStr = localStorage.getItem("nestly_user");
  const currentUser = userStr ? JSON.parse(userStr) : null;
  
  // Tạo dữ liệu hiển thị
  const avatarText = currentUser ? getInitials(currentUser.fullName) : "U";
  const displayName = currentUser ? currentUser.fullName : "Khách";
  const displayRole = currentUser?.role === "Partner" ? "Đối tác Nestly" : (currentUser?.role === "Admin" ? "Quản trị viên" : "Thành viên Nestly");

  const handleNavigate = (path) => {
    navigate(path);
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogout = () => {
    onLogout();
    handleNavigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 py-2 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 py-1 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" className="group flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#163c31] text-white transition-transform group-hover:-rotate-6"><Icon name="bed" size={20} /></span>
          <span className="text-2xl font-extrabold tracking-tight text-[#173b31]">Nestly</span>
        </Link>

        <div className="relative">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 pr-3 shadow-sm transition hover:border-slate-300 hover:shadow-md">
            {loggedIn ? (
              <span className="grid size-9 place-items-center rounded-lg bg-[#d4a34f] text-sm font-extrabold text-white">
                {avatarText} {/* HIỂN THỊ AVATAR ĐỘNG */}
              </span>
            ) : (
              <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icon name="users" size={18} /></span>
            )}
            <Icon name="menu" size={18} />
          </button>
          
          {open && (
            <div className="absolute right-0 top-14 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {loggedIn ? (
                <>
                  <div className="bg-[#f2f7f5] p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid size-12 place-items-center rounded-full bg-[#d4a34f] font-bold text-white">
                        {avatarText}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{displayName} {/* HIỂN THỊ TÊN THẬT */}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{displayRole}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 border-b border-slate-100">
                    <button onClick={() => handleNavigate("/profile")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-slate-50"><Icon name="users" size={18} /> Thông tin cá nhân</button>
                  </div>
                  <div className="p-2">
                    <button onClick={() => handleNavigate("/partner-apply")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-slate-50"><Icon name="home" size={18} /> Làm shop</button>
                    <button onClick={() => handleNavigate("/partner")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-slate-50"><Icon name="bed" size={18} /> Trung tâm đối tác</button>
                    <button onClick={() => handleNavigate("/admin")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-slate-50"><Icon name="shield" size={18} /> Khu vực quản trị</button>
                  </div>
                  <div className="border-t border-slate-100 p-2"><button onClick={handleLogout} className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50">Đăng xuất</button></div>
                </>
              ) : (
                <div className="p-5">
                  <button onClick={() => handleNavigate("/login")} className="mt-2 w-full rounded-xl bg-[#173b31] py-3 text-sm font-bold text-white transition hover:bg-[#245a4b]">Đăng nhập</button>
                  <button onClick={() => handleNavigate("/register")} className="mt-3 w-full rounded-xl border border-[#173b31] py-3 text-sm font-bold text-[#173b31] transition hover:bg-slate-50">Tạo tài khoản</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}