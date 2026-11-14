// File: src/pages/VerifyEmail.jsx - mở từ link trong email xác nhận đăng ký (?token=...)
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../services/api";
import AuthCard, { Notice } from "../components/AuthCard";
import ResendVerification from "../components/ResendVerification";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const validToken = /^[a-f0-9]{64}$/.test(token);
  const [state, setState] = useState(validToken ? { status: "loading" } : { status: "error", text: "Link xác nhận bị thiếu hoặc sai." });
  const sent = useRef(false); // link chỉ dùng được 1 lần -> không gọi API 2 lần (React StrictMode)

  useEffect(() => {
    if (!validToken || sent.current) return;
    sent.current = true;
    API.post("/auth/verify-email", { token })
      .then((res) => setState({ status: "success", text: res.data.message, username: res.data.username }))
      .catch((error) => setState({ status: "error", text: error.response?.data?.message || "Không xác nhận được email." }));
  }, [token, validToken]);

  return (
    <AuthCard eyebrow="Xác nhận email" title={state.status === "success" ? "Email đã được xác nhận" : "Kích hoạt tài khoản"}>
      {state.status === "loading" && <Notice>Đang xác nhận email...</Notice>}
      {state.status === "success" && (
        <>
          <Notice tone="success">
            {state.text}
            {state.username && <> Tên đăng nhập của bạn: <b>{state.username}</b></>}
          </Notice>
          <Link to="/login" className="mt-5 block rounded-xl bg-[#173b31] py-3.5 text-center font-bold text-white hover:bg-[#245a4b]">
            Đăng nhập
          </Link>
        </>
      )}
      {state.status === "error" && (
        <>
          <Notice tone="error">{state.text}</Notice>
          <p className="mt-6 text-sm font-bold text-slate-700">Gửi lại email xác nhận</p>
          <ResendVerification />
        </>
      )}
    </AuthCard>
  );
}
