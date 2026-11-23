// File: src/components/PaymentButtons.jsx - chọn cổng thanh toán (VNPay / MoMo) cho đơn đang chờ
import { useState } from "react";
import API from "../services/api";

export default function PaymentButtons({ body, disabled, onError }) {
  const [busy, setBusy] = useState(""); // 'vnpay' | 'momo'

  const pay = async (provider) => {
    setBusy(provider);
    onError?.("");
    try {
      const res = await API.post(`/payments/${provider}/create_url`, body);
      window.location.href = res.data.paymentUrl; // chuyển sang trang cổng thanh toán
    } catch (error) {
      onError?.(error.response?.data?.message || `Không thể khởi tạo thanh toán ${provider === "momo" ? "MoMo" : "VNPay"} lúc này.`);
      setBusy("");
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={() => pay("vnpay")}
        disabled={disabled || Boolean(busy)}
        className="flex-1 rounded-2xl bg-[#005BAA] px-6 py-4 font-bold text-white transition hover:bg-[#004785] disabled:opacity-60 sm:flex-none"
      >
        {busy === "vnpay" ? "Đang kết nối VNPay..." : "Thanh toán qua VNPay"}
      </button>
      <button
        type="button"
        onClick={() => pay("momo")}
        disabled={disabled || Boolean(busy)}
        className="flex-1 rounded-2xl bg-[#A50064] px-6 py-4 font-bold text-white transition hover:bg-[#87004f] disabled:opacity-60 sm:flex-none"
      >
        {busy === "momo" ? "Đang kết nối MoMo..." : "Thanh toán qua MoMo"}
      </button>
    </div>
  );
}
