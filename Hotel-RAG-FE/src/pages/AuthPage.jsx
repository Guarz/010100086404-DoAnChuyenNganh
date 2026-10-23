// File: src/pages/AuthPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon"; // Sửa lại đường dẫn này nếu thư mục Icon của bạn khác
import API from "../services/api";

const photos = {
  anam: "https://images.unsplash.com/photo-1596178065887-1198b6148b2b?auto=format&fit=crop&w=900&q=85",
};

export default function AuthPage({ mode = "login", onSuccess }) {
  // 1. TOÀN BỘ HOOKS VÀ KHAI BÁO PHẢI NẰM TRONG NÀY
  const isLogin = mode === "login";
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  // 2. CÁC HÀM XỬ LÝ SỰ KIỆN CŨNG NẰM TRONG NÀY
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      if (isLogin) {
        // GỌI API ĐĂNG NHẬP
        const res = await API.post("/auth/login", {
          email: formData.email,
          password: formData.password,
        });

        if (res.data.success) {
          // Lưu Token và Info vào LocalStorage
          localStorage.setItem("nestly_token", res.data.token);
          localStorage.setItem("nestly_user", JSON.stringify(res.data.user));

          if (onSuccess) onSuccess();
          navigate(res.data.user.role === "Admin" ? "/admin" : "/profile");
        }
      } else {
        // GỌI API ĐĂNG KÝ
        const res = await API.post("/auth/register", formData);
        if (res.data.success) {
          alert("Đăng ký thành công! Hãy đăng nhập lại.");
          navigate("/login");
        }
      }
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại.",
      );
    }
  };

  // 3. GIAO DIỆN (JSX)
  return (
    <main className="min-h-[calc(100vh-108px)] bg-[#f4f7f6] py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
        {/* Cột hình ảnh bên trái */}
        <div className="relative hidden min-h-[650px] overflow-hidden lg:block">
          <img
            src={photos.anam}
            alt="Khu nghỉ dưỡng Nestly"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#102f28] via-[#102f28]/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-white">
            <span className="grid size-11 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <Icon name="sparkle" />
            </span>
            <p className="mt-6 text-3xl font-bold leading-tight">
              Mỗi chuyến đi hay đều bắt đầu từ một nơi ở thật vừa ý.
            </p>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Hơn 12.000 chỗ nghỉ đã được tuyển chọn trên khắp Việt Nam.
            </p>
          </div>
        </div>

        {/* Cột Form bên phải */}
        <div className="flex flex-col justify-center p-7 sm:p-12">
          <button
            onClick={() => navigate("/")}
            className="mb-10 flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#173b31]"
          >
            ← Về trang chủ
          </button>

          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b7812d]">
            {isLogin ? "Chào mừng trở lại" : "Tham gia Nestly"}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#173b31]">
            {isLogin ? "Đăng nhập tài khoản" : "Tạo tài khoản mới"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {isLogin
              ? "Quản lý đặt phòng và tận hưởng ưu đãi dành riêng cho thành viên."
              : "Chỉ mất một phút để bắt đầu hành trình của bạn."}
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold transition hover:bg-slate-50"
            >
              G&nbsp;&nbsp;Google
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold transition hover:bg-slate-50"
            >
              f&nbsp;&nbsp;Facebook
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> hoặc tiếp tục với
            email <span className="h-px flex-1 bg-slate-200" />
          </div>

          {/* FORM GỌI HÀM SUBMIT TẠI ĐÂY */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <p className="text-sm font-bold text-red-500">{errorMsg}</p>
            )}

            {!isLogin && (
              <label className="block text-sm font-bold text-slate-700">
                Họ và tên
                <input
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Ví dụ: Nguyễn Minh An"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 font-normal outline-none transition focus:border-[#173b31] focus:ring-3 focus:ring-emerald-100"
                  required
                />
              </label>
            )}

            <label className="block text-sm font-bold text-slate-700">
              Email
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="email@example.com"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 font-normal outline-none transition focus:border-[#173b31] focus:ring-3 focus:ring-emerald-100"
                required
              />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Mật khẩu
              <div className="relative mt-2">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 pr-16 font-normal outline-none transition focus:border-[#173b31] focus:ring-3 focus:ring-emerald-100"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#173b31]"
                >
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>
            </label>

            {!isLogin && (
              <label className="flex items-start gap-3 text-xs leading-5 text-slate-500">
                <input
                  type="checkbox"
                  className="mt-1 accent-[#173b31]"
                  required
                />
                Tôi đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư
                của Nestly.
              </label>
            )}

            {isLogin && (
              <div className="mt-4 flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-500">
                  <input type="checkbox" className="accent-[#173b31]" /> Ghi nhớ
                  tôi
                </label>
                <button type="button" className="font-bold text-[#173b31]">
                  Quên mật khẩu?
                </button>
              </div>
            )}

            <button
              type="submit"
              className="mt-6 w-full rounded-xl bg-[#173b31] py-3.5 font-bold text-white shadow-lg shadow-emerald-950/10 transition hover:bg-[#245a4b]"
            >
              {isLogin ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <button
              type="button"
              onClick={() => {
                navigate(isLogin ? "/register" : "/login");
                setFormData({ fullName: "", email: "", password: "" }); // Reset form khi chuyển trang
                setErrorMsg("");
              }}
              className="font-bold text-[#173b31] hover:underline"
            >
              {isLogin ? "Đăng ký ngay" : "Đăng nhập"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
