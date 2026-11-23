// File: src/components/PaymentButtons.jsx - nút thanh toán VNPay cho đơn đang chờ (dùng chung đơn phòng / đơn xe)
import { useState } from "react";
import API from "../services/api";

export default function PaymentButtons({ body, disabled, onError }) {
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    setBusy(true);
    onError?.("");
    try {
      const res = await API.post("/payments/vnpay/create_url", body);
      window.location.href = res.data.paymentUrl; // chuyển sang trang cổng thanh toán
    } catch (error) {
      onError?.(error.response?.data?.message || "Không thể khởi tạo thanh toán VNPay lúc này.");
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={pay}
      disabled={disabled || busy}
      className="w-full rounded-2xl bg-[#005BAA] px-6 py-4 font-bold text-white transition hover:bg-[#004785] disabled:opacity-60 sm:w-auto"
    >
      {busy ? "Đang kết nối VNPay..." : "Thanh toán qua VNPay"}
    </button>
  );
}
