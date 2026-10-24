import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import API from "../services/api";

export default function VNPayReturn() {
  const [status, setStatus] = useState("verifying");
  const location = useLocation();
  const navigate = useNavigate();
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    API.get(`/payments/vnpay/return${location.search}`)
      .then((res) => {
        if (res.data.success) {
          setStatus("success");
          setTimeout(() => navigate("/profile"), 3000);
        } else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [location, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f5ef] p-5">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        {status === "verifying" && <h2 className="text-2xl font-bold text-[#173b31]">Đang kiểm tra giao dịch...</h2>}
        {status === "success" && (
          <>
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-600">✓</div>
            <h2 className="mt-6 text-2xl font-bold text-[#173b31]">Thanh toán thành công!</h2>
            <p className="mt-2 text-stone-500">Đang chuyển về trang Lịch sử...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-red-100 text-4xl text-red-600">✕</div>
            <h2 className="mt-6 text-2xl font-bold text-red-600">Giao dịch thất bại</h2>
            <Link to="/hotels" className="mt-6 block rounded-xl bg-[#173b31] py-3 font-bold text-white">Quay về Trang chủ</Link>
          </>
        )}
      </div>
    </div>
  );
}