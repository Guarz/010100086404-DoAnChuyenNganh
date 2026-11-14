// File: src/pages/ForgotPassword.jsx - nhập email để nhận link đặt lại mật khẩu
import { useState } from "react";
import API from "../services/api";
import AuthCard, { Notice, authInputClass } from "../components/AuthCard";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { tone, text }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await API.post("/auth/forgot-password", { email });
      setResult({ tone: "success", text: res.data.message });
    } catch (error) {
      setResult({ tone: "error", text: error.response?.data?.message || "Không gửi được yêu cầu, vui lòng thử lại." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      eyebrow="Quên mật khẩu"
      title="Lấy lại quyền truy cập"
      description="Nhập email đã đăng ký. Chúng tôi sẽ gửi link để bạn đặt mật khẩu mới (hiệu lực 30 phút)."
    >
      <form onSubmit={submit} className="space-y-4">
        {result && <Notice tone={result.tone}>{result.text}</Notice>}
        <label className="block text-sm font-bold text-slate-700">
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className={authInputClass}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#173b31] py-3.5 font-bold text-white transition hover:bg-[#245a4b] disabled:opacity-60"
        >
          {busy ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
        </button>
      </form>
    </AuthCard>
  );
}
