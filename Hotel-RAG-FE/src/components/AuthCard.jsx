// File: src/components/AuthCard.jsx
// Khung thẻ dùng chung cho các trang tài khoản nhỏ: xác nhận email, quên / đặt lại mật khẩu.
import { Link } from "react-router-dom";

export const authInputClass =
  "mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 font-normal outline-none transition focus:border-[#173b31] focus:ring-3 focus:ring-emerald-100";

export function Notice({ tone = "info", children }) {
  const styles = {
    info: "border-slate-200 bg-slate-50 text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    error: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border p-4 text-sm font-semibold leading-6 ${styles[tone]}`}>
      {children}
    </div>
  );
}

export default function AuthCard({ eyebrow, title, description, children }) {
  return (
    <main className="grid min-h-[calc(100vh-108px)] place-items-center bg-[#f4f7f6] px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-10">
        <Link to="/login" className="-ml-2 inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-slate-500 transition hover:text-[#173b31]">
          ← Về đăng nhập
        </Link>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-[#b7812d]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#173b31] sm:text-3xl">{title}</h1>
        {description && <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>}
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}
