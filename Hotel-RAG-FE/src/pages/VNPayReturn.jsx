// File: src/pages/VNPayReturn.jsx
// Trang khách quay về sau khi thanh toán VNPay (/payment/vnpay-return).
// Gửi nguyên query về backend để kiểm tra chữ ký và xác nhận đơn.
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import API from "../services/api";
import Icon from "../components/Icon";

export default function VNPayReturn() {
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const hasVerified = useRef(false);
  const params = new URLSearchParams(location.search);
  const bookingId = params.get("vnp_TxnRef"); // mã đơn VNPay gửi về
  const [type, setType] = useState("hotel"); // 'hotel' | 'transfer' (backend trả về theo loại đơn)

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    API.get(`/payments/vnpay/return${location.search}`)
      .then((res) => {
        const kind = res.data.type || "hotel";
        setType(kind);
        if (res.data.success) {
          setStatus("success");
          setTimeout(() => navigate(kind === "transfer" ? "/profile?tab=transfers" : "/profile?tab=booking"), 3000);
        } else {
          setMessage(res.data.message || "");
          setStatus("error");
        }
      })
      .catch((err) => {
        if (err.response?.data?.type) setType(err.response.data.type);
        setMessage(err.response?.data?.message || "");
        setStatus("error");
      });
  }, [location, navigate]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#f7f5ef] p-5">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        {status === "verifying" && (
          <h1 role="status" className="text-2xl font-bold text-[#173b31]">Đang kiểm tra giao dịch VNPay...</h1>
        )}
        {status === "success" && (
          <div role="status">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Icon name="check" size={40} />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-[#173b31]">Thanh toán VNPay thành công!</h1>
            <p className="mt-2 text-stone-500">Đang chuyển về trang Lịch sử...</p>
          </div>
        )}
        {status === "error" && (
          <div role="alert">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Icon name="x" size={40} />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-red-600">Giao dịch thất bại</h1>
            {message && <p className="mt-2 text-sm text-stone-600">{message}</p>}
            <Link
              to={bookingId ? (type === "transfer" ? `/transfer-checkout/${bookingId}` : `/checkout/${bookingId}`) : "/hotels"}
              className="mt-6 block rounded-xl bg-[#173b31] py-3 font-bold text-white"
            >
              {bookingId ? "Quay lại đơn hàng để thử thanh toán lại" : "Quay về Trang chủ"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
