// File: src/pages/AuthPage.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon"; // Sửa lại đường dẫn này nếu thư mục Icon của bạn khác
import API from "../services/api";
import ResendVerification from "../components/ResendVerification";

const EMPTY_FORM = { username: "", email: "", password: "" };
const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 font-normal outline-none transition focus:border-[#173b31] focus:ring-3 focus:ring-emerald-100";

const photos = {
  anam: "https://images.unsplash.com/photo-1596178065887-1198b6148b2b?auto=format&fit=crop&w=900&q=85",
};

export default function AuthPage({ mode = "login", onSuccess }) {
  // 1. TOÀN BỘ HOOKS VÀ KHAI BÁO PHẢI NẰM TRONG NÀY
  const isLogin = mode === "login";
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  // Đăng ký xong cần xác nhận email -> hiện hướng dẫn thay cho form
  const [pendingEmail, setPendingEmail] = useState("");
  const [mailFailed, setMailFailed] = useState(false); // backend tạo được tài khoản nhưng gửi mail lỗi
  // Đăng nhập bị chặn vì chưa xác nhận email -> hiện ô gửi lại email xác nhận
  const [needsVerification, setNeedsVerification] = useState(false);

  // 2. CÁC HÀM XỬ LÝ SỰ KIỆN CŨNG NẰM TRONG NÀY
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setNeedsVerification(false);
    setBusy(true);

    try {
      if (isLogin) {
        // GỌI API ĐĂNG NHẬP bằng tên đăng nhập (tài khoản cũ có thể gõ email vào cùng ô)
        const res = await API.post("/auth/login", {
          username: formData.username,
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
        if (res.data.requiresVerification) {
          setPendingEmail(res.data.email || formData.email);
          setMailFailed(res.data.mailSent === false);
          setSuccessMsg(res.data.message);
        } else if (res.data.success) {
          setSuccessMsg(`${res.data.message} Đang chuyển đến Đăng nhập...`);
          setTimeout(() => {
            navigate("/login");
            setSuccessMsg("");
            setFormData(EMPTY_FORM);
          }, 2000);
        }
      }
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại.",
      );
      setNeedsVerification(error.response?.data?.code === "EMAIL_NOT_VERIFIED");
    } finally {
      setBusy(false);
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
            className="mb-8 -ml-2 flex min-h-10 w-fit items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-500 transition hover:text-[#173b31]"
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

          {pendingEmail ? (
            <div className="mt-8">
              {mailFailed ? (
                <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
                  <p className="font-bold">Đã tạo tài khoản nhưng chưa gửi được email xác nhận</p>
                  <p className="mt-1">{successMsg}</p>
                </div>
              ) : (
                <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-800">
                  <p className="font-bold">Kiểm tra hộp thư của bạn</p>
                  <p className="mt-1">{successMsg}</p>
                  <p className="mt-2 text-emerald-700/80">Không thấy email? Xem mục Spam / Quảng cáo, hoặc gửi lại bên dưới.</p>
                </div>
              )}
              <ResendVerification defaultEmail={pendingEmail} />
              <Link to="/login" className="mt-6 block rounded-xl bg-[#173b31] py-3.5 text-center font-bold text-white hover:bg-[#245a4b]">
                Đã xác nhận, tới trang Đăng nhập
              </Link>
            </div>
          ) : (
          <>
          {/* Lỗi + ô gửi lại email xác nhận nằm NGOÀI form đăng nhập (không lồng form trong form) */}
          {(errorMsg || needsVerification) && (
            <div className="mt-8 space-y-4">
              {errorMsg && (
                <p role="alert" className="text-sm font-bold text-red-500">{errorMsg}</p>
              )}
              {needsVerification && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-800">Chưa nhận được email xác nhận?</p>
                  <ResendVerification />
                </div>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} className={`${errorMsg || needsVerification ? "mt-5" : "mt-8"} space-y-4`}>
            {successMsg && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 shadow-sm">
                <svg
                  className="size-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {successMsg}
              </div>
            )}
            <label className="block text-sm font-bold text-slate-700">
              Tên đăng nhập
              <input
                name="username"
                value={formData.username}
                onChange={handleChange}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={isLogin ? "Tên đăng nhập" : "Ví dụ: minh.an"}
                pattern={isLogin ? undefined : "[A-Za-z0-9._]{3,30}"}
                title={isLogin ? undefined : "3–30 ký tự: chữ không dấu, số, dấu chấm hoặc gạch dưới"}
                aria-describedby={isLogin ? undefined : "username-hint"}
                className={inputClass}
                required
              />
              {!isLogin && (
                <span id="username-hint" className="mt-1.5 block text-xs font-normal text-slate-400">
                  3–30 ký tự: chữ không dấu, số, dấu chấm hoặc gạch dưới.
                </span>
              )}
            </label>

            {!isLogin && (
              <label className="block text-sm font-bold text-slate-700">
                Email
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  placeholder="email@example.com"
                  aria-describedby="email-hint"
                  className={inputClass}
                  required
                />
                <span id="email-hint" className="mt-1.5 block text-xs font-normal text-slate-400">
                  Chúng tôi sẽ gửi email xác nhận để kích hoạt tài khoản.
                </span>
              </label>
            )}

            <label className="block text-sm font-bold text-slate-700">
              Mật khẩu
              <div className="relative mt-2">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3.5 pr-16 font-normal outline-none transition focus:border-[#173b31] focus:ring-3 focus:ring-emerald-100"
                  required
                  minLength={isLogin ? undefined : 8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  className="absolute right-2 top-1/2 min-h-9 -translate-y-1/2 rounded-lg px-2 text-xs font-bold text-[#173b31] hover:bg-slate-100"
                >
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>
            </label>

            {!isLogin && (
              <label className="flex items-start gap-3 text-xs leading-5 text-slate-500">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[#173b31]"
                  required
                />
                Tôi đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư
                của Nestly.
              </label>
            )}

            {isLogin && (
              <div className="mt-4 flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-500">
                  <input type="checkbox" className="size-4 accent-[#173b31]" /> Ghi nhớ
                  tôi
                </label>
                <Link to="/forgot-password" className="font-bold text-[#173b31] hover:underline">
                  Quên mật khẩu?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full rounded-xl bg-[#173b31] py-3.5 font-bold text-white shadow-lg shadow-emerald-950/10 transition hover:bg-[#245a4b] disabled:opacity-60"
            >
              {busy ? "Đang xử lý..." : isLogin ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>
          </>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <button
              type="button"
              onClick={() => {
                navigate(isLogin ? "/register" : "/login");
                setFormData(EMPTY_FORM); // Reset form khi chuyển trang
                setErrorMsg("");
                setSuccessMsg("");
                setPendingEmail("");
                setNeedsVerification(false);
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
