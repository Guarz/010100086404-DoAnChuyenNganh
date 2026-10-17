// File: src/pages/ProfilePage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon"; // Chỉnh đường dẫn nếu cần

export default function ProfilePage({ onLogout }) {
  const [active, setActive] = useState("personal");
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  // 1. Lấy thông tin user từ LocalStorage
  const userStr = localStorage.getItem("nestly_user");
  const currentUser = userStr ? JSON.parse(userStr) : null;

  // Nếu chưa đăng nhập mà lọt vào trang này thì đá về trang chủ
  useEffect(() => {
    if (!currentUser) navigate("/login");
  }, [currentUser, navigate]);

  // State lưu dữ liệu form sửa đổi
  const [formData, setFormData] = useState({
    fullName: currentUser?.fullName || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
  });

  if (!currentUser) return null; // Tránh lỗi render khi đang điều hướng

  const getInitials = (name) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };
  
  const avatarText = getInitials(currentUser.fullName);
  const displayRole = currentUser.role === "Partner" ? "ĐỐI TÁC NESTLY" : (currentUser.role === "Admin" ? "QUẢN TRỊ VIÊN" : "THÀNH VIÊN NESTLY");

  const navItems = [
    { id: "personal", label: "Thông tin cá nhân", icon: "users" },
    { id: "security", label: "Mật khẩu & bảo mật", icon: "shield" },
    { id: "booking", label: "Lịch sử đặt chỗ", icon: "calendar" },
    { id: "payment", label: "Phương thức thanh toán", icon: "wallet" },
  ];

  const handleLogoutClick = () => {
    if (onLogout) onLogout();
    navigate("/");
  };

  return (
    <main className="min-h-screen bg-[#f4f7f6] py-10">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-widest text-[#b7812d]">Tài khoản của tôi</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#173b31]">Quản lý thông tin cá nhân</h1>
        </div>

        {saved && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <Icon name="check" /> Thông tin của bạn đã được cập nhật.
          </div>
        )}

        <div className="grid gap-7 lg:grid-cols-[270px_1fr]">
          <aside className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-6 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#d4a34f] text-xl font-extrabold text-white">
                {avatarText}
              </span>
              <p className="mt-3 font-bold text-slate-900">{currentUser.fullName}</p>
              <p className="mt-1 text-xs text-slate-500">{currentUser.email}</p>
              <span className="mt-3 inline-block rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                {displayRole}
              </span>
            </div>

            <nav className="p-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActive(item.id); setSaved(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                    active === item.id ? "bg-[#e8f2ed] text-[#173b31]" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="border-t border-slate-100 p-2">
              <button onClick={handleLogoutClick} className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50">
                Đăng xuất
              </button>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {active === "personal" && (
              <>
                <div className="border-b border-slate-100 pb-6">
                  <h2 className="text-xl font-bold text-slate-900">Thông tin cá nhân</h2>
                  <p className="mt-2 text-sm text-slate-500">Thông tin này được sử dụng cho các đơn đặt phòng của bạn.</p>
                </div>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-bold text-slate-700 sm:col-span-2">
                    Họ và tên
                    <input value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#173b31]" />
                  </label>
                  <label className="text-sm font-bold text-slate-700">
                    Email
                    <input value={formData.email} disabled className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal text-slate-500 outline-none cursor-not-allowed" />
                  </label>
                  <label className="text-sm font-bold text-slate-700">
                    Số điện thoại
                    <input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="Chưa cập nhật" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#173b31]" />
                  </label>
                </div>
                <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
                  <button onClick={() => setSaved(true)} className="rounded-xl bg-[#173b31] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#245a4b]">
                    Lưu thay đổi
                  </button>
                </div>
              </>
            )}
            {/* Các tab khác giữ nguyên giao diện cũ... */}
          </section>
        </div>
      </div>
    </main>
  );
}