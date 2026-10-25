// File: src/pages/Checkout.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";

export default function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [error, setError] = useState("");

  // Thêm state loading khi bấm thanh toán VNPay
  const [payLoading, setPayLoading] = useState(false);

  useEffect(() => {
    const loadBooking = async () => {
      try {
        const response = await API.get(`/bookings/${id}`);
        setBooking(response.data.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Không thể tải thông tin đơn đặt phòng.",
        );
      } finally {
        setLoading(false);
      }
    };
    loadBooking();
  }, [id]);

  useEffect(() => {
    if (booking?.bookingStatus !== "Pending") return undefined;

    const expiryTime = new Date(
      booking.expiresAt ||
        new Date(new Date(booking.createdAt).getTime() + 5 * 60 * 1000),
    ).getTime();

    let expirationChecked = false;

    const updateRemainingTime = async () => {
      const seconds = Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000));
      setRemainingSeconds(seconds);

      if (seconds === 0 && !expirationChecked) {
        expirationChecked = true;
        try {
          await API.get(`/bookings/${id}`);
        } catch (requestError) {
          setBooking(null);
          setError(
            requestError.response?.data?.message ||
              "Đơn tạm đã hết hạn. Vui lòng đặt lại nếu bạn vẫn muốn tiếp tục.",
          );
        }
      }
    };

    updateRemainingTime();
    const timer = window.setInterval(updateRemainingTime, 1000);
    return () => window.clearInterval(timer);
  }, [booking, id]);

  // HÀM MỚI: Xử lý gọi API sang VNPay
  const handleVNPayPayment = async () => {
    setPayLoading(true);
    try {
      const response = await API.post("/payments/vnpay/create_url", {
        bookingId: booking._id,
      });
      if (response.data.success) {
        window.location.href = response.data.paymentUrl; // Đẩy sang cổng VNPay
      }
    } catch (error) {
      error.response?.data?.message ||
        "Không thể khởi tạo thanh toán VNPay lúc này.";
      setPayLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center font-bold text-[#173b31]">
        Đang tải đơn đặt phòng...
      </div>
    );
  }

  if (!booking) {
    return (
      <main className="grid min-h-[60vh] place-items-center bg-[#f7f5ef] px-5">
        <div className="text-center">
          <p role="alert" className="font-semibold text-red-700">
            {error}
          </p>
          <button
            type="button"
            onClick={() => navigate("/hotels")}
            className="mt-5 rounded-xl bg-[#173b31] px-5 py-3 font-bold text-white"
          >
            Quay lại khách sạn
          </button>
        </div>
      </main>
    );
  }

  const isPending = booking.bookingStatus === "Pending";

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-16">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-xl sm:p-10">
        <h1 className="border-b border-stone-100 pb-5 font-display text-3xl font-bold text-[#173b31]">
          Xác nhận & thanh toán
        </h1>

        <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-6">
          <h2 className="text-xl font-bold text-stone-800">
            {booking.hotelId?.hotelName || "Đơn đặt phòng"} · #
            {booking._id.slice(-6).toUpperCase()}
          </h2>
          <div className="mt-4 grid gap-3 text-sm font-semibold text-stone-600 sm:grid-cols-2">
            <p>
              Ngày nhận:{" "}
              <span className="text-stone-900">
                {new Date(booking.checkInDate).toLocaleDateString("vi-VN")}
              </span>
            </p>
            <p>
              Ngày trả:{" "}
              <span className="text-stone-900">
                {new Date(booking.checkOutDate).toLocaleDateString("vi-VN")}
              </span>
            </p>
            {booking.bookingDetails.map((detail) => (
              <p key={detail._id || detail.roomTypeId?._id}>
                Phòng:{" "}
                <span className="text-stone-900">
                  {detail.roomTypeId?.title || "Loại phòng"} · {detail.quantity}{" "}
                  phòng · {detail.totalNights} đêm
                </span>
              </p>
            ))}
            <p>
              Trạng thái:{" "}
              <span
                className={
                  isPending ? "text-amber-600" : "font-bold text-emerald-700"
                }
              >
                {isPending ? "Đơn tạm - chờ thanh toán" : "Đã thanh toán"}
              </span>
            </p>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}

        {isPending ? (
          <div className="mt-8 border-t border-stone-100 pt-8">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-bold text-amber-900">
                Vui lòng hoàn tất thanh toán
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                Đơn hàng sẽ tự động hủy sau 5 phút nếu không được thanh toán
                {remainingSeconds !== null &&
                  ` (còn ${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")})`}
                .
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-stone-500 font-semibold mb-1">
                  Tổng thanh toán
                </p>
                <p className="text-3xl font-extrabold text-[#b7812d]">
                  {booking.totalAmount.toLocaleString("vi-VN")}₫
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/hotels")}
                  className="rounded-2xl bg-stone-100 px-6 py-4 font-bold text-stone-600 transition hover:bg-stone-200"
                >
                  Hủy
                </button>
                {/* NÚT THANH TOÁN VNPAY ĐƯỢC GẮN VÀO ĐÂY */}
                <button
                  type="button"
                  onClick={handleVNPayPayment}
                  disabled={payLoading || remainingSeconds === 0}
                  className="rounded-2xl bg-[#005BAA] px-8 py-4 font-bold text-white transition hover:bg-[#004785] disabled:opacity-60 flex items-center gap-2"
                >
                  {payLoading ? "Đang kết nối..." : "Thanh toán qua VNPay"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-5 border-t border-stone-100 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-3xl font-extrabold text-[#b7812d]">
              {booking.totalAmount.toLocaleString("vi-VN")}₫
            </p>
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="rounded-2xl bg-[#173b31] px-8 py-4 font-bold text-white transition hover:bg-[#245a4b]"
            >
              Xem lịch sử đặt chỗ
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
