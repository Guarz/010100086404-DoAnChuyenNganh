// File: src/components/ResendVerification.jsx - ô nhập email + nút "Gửi lại email xác nhận"
import { useState } from "react";
import API from "../services/api";
import { Notice, authInputClass } from "./AuthCard";

export default function ResendVerification({ defaultEmail = "" }) {
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await API.post("/auth/resend-verification", { email });
      setResult({ tone: "success", text: res.data.message });
    } catch (error) {
      setResult({ tone: "error", text: error.response?.data?.message || "Không gửi được, vui lòng thử lại." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      {result && <Notice tone={result.tone}>{result.text}</Notice>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Email đã đăng ký</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email đã đăng ký"
            className={`${authInputClass} mt-0`}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-xl border border-[#173b31] px-5 py-3.5 text-sm font-bold text-[#173b31] transition hover:bg-slate-50 disabled:opacity-60"
        >
          {busy ? "Đang gửi..." : "Gửi lại"}
        </button>
      </div>
    </form>
  );
}
