// File: src/pages/ResetPassword.jsx - mở từ link trong email (?token=...) để đặt mật khẩu mới
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import API from "../services/api";
import AuthCard, { Notice, authInputClass } from "../components/AuthCard";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setResult({ tone: "error", text: "Hai mật khẩu chưa khớp nhau." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await API.post("/auth/reset-password", { token, password });
      setResult({ tone: "success", text: res.data.message, done: true });
      setTimeout(() => navigate("/login"), 2500);
    } catch (error) {
      setResult({
        tone: "error",
        text: error.response?.data?.message || "Không đặt được mật khẩu mới, vui lòng thử lại.",
        expired: error.response?.data?.code === "TOKEN_EXPIRED",
      });
      setBusy(false);
    }
  };

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <AuthCard eyebrow="Đặt lại mật khẩu" title="Link không hợp lệ">
        <Notice tone="error">Link đặt lại mật khẩu bị thiếu hoặc sai. Hãy mở lại link trong email, hoặc yêu cầu link mới.</Notice>
        <Link to="/forgot-password" className="mt-5 block rounded-xl bg-[#173b31] py-3.5 text-center font-bold text-white hover:bg-[#245a4b]">
          Yêu cầu link mới
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard eyebrow="Đặt lại mật khẩu" title="Tạo mật khẩu mới" description="Mật khẩu tối thiểu 8 ký tự.">
      <form onSubmit={submit} className="space-y-4">
        {result && <Notice tone={result.tone}>{result.text}{result.done && " Đang chuyển tới trang đăng nhập..."}</Notice>}
        {result?.expired && (
          <Link to="/forgot-password" className="block text-sm font-bold text-[#b7812d] hover:underline">
            Yêu cầu link mới →
          </Link>
        )}
        <label className="block text-sm font-bold text-slate-700">
          Mật khẩu mới
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${authInputClass} pr-16`}
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-4 top-1/2 mt-1 -translate-y-1/2 text-xs font-bold text-[#173b31]"
            >
              {show ? "Ẩn" : "Hiện"}
            </button>
          </div>
        </label>
        <label className="block text-sm font-bold text-slate-700">
          Nhập lại mật khẩu mới
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={authInputClass}
            minLength={8}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#173b31] py-3.5 font-bold text-white transition hover:bg-[#245a4b] disabled:opacity-60"
        >
          {busy ? "Đang lưu..." : "Lưu mật khẩu mới"}
        </button>
      </form>
    </AuthCard>
  );
}
