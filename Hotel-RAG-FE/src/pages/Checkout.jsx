import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";

export default function Checkout() {
  const { id } = useParams(); // id của Booking
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);

  useEffect(() => {
    // (Tạm thời gọi API xem chi tiết booking, bạn cần có API GET /bookings/:id ở backend)
    API.get(`/bookings/${id}`)
      .then(res => {
        if (res.data.success) setBooking(res.data.data);
        setLoading(false);
      })
      .catch(() => {
        alert("Lỗi lấy thông tin đơn hàng.");
        navigate("/hotels");
      });
  }, [id, navigate]);

  const handleVNPayPayment = async () => {
    setPayLoading(true);
    try {
      const response = await API.post("/payments/vnpay/create_url", { bookingId: booking._id });
      if (response.data.success) {
        window.location.href = response.data.paymentUrl; // Chuyển hướng qua cổng VNPay
      }
    } catch (error) {
        error.response?.data?.message ||
          "Không thể khởi tạo thanh toán VNPay lúc này.",
      setPayLoading(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-[#173b31]">Đang tải Đơn hàng...</div>;

  return (
    <div className="min-h-screen bg-[#f7f5ef] py-16 px-5">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-display font-bold text-[#173b31] border-b border-stone-100 pb-5">Xác nhận & Thanh toán</h1>
        
        <div className="mt-8 rounded-2xl bg-stone-50 p-6 border border-stone-200">
          <h2 className="text-xl font-bold text-stone-800">Mã đơn: #{booking._id.slice(-6).toUpperCase()}</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-stone-600 font-semibold">
            <p>Ngày Nhận: <span className="text-stone-900">{new Date(booking.checkInDate).toLocaleDateString("vi-VN")}</span></p>
            <p>Ngày Trả: <span className="text-stone-900">{new Date(booking.checkOutDate).toLocaleDateString("vi-VN")}</span></p>
            <p>Trạng thái: <span className="text-amber-600">Đang chờ thanh toán</span></p>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-stone-100 pt-8">
          <div>
            <p className="text-stone-500 font-semibold">Tổng tiền cần thanh toán</p>
            <p className="text-4xl font-extrabold text-[#b7812d]">{booking.totalAmount.toLocaleString("vi-VN")}₫</p>
          </div>
          <button 
            onClick={handleVNPayPayment} 
            disabled={payLoading}
            className="rounded-2xl bg-[#005BAA] px-10 py-4 font-bold text-white shadow-lg transition hover:bg-[#004785] disabled:opacity-60 flex items-center gap-3"
          >
            {payLoading ? "Đang kết nối..." : "Thanh toán qua VNPay"}
          </button>
        </div>
      </div>
    </div>
  );
}