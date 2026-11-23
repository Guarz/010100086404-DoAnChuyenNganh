// File: src/pages/TransferCheckout.jsx - thanh toán đơn xe đưa đón (giữ xe 5 phút, VNPay)
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import { TRANSFER_STATUS, formatPickup, formatVnd } from "../constants/transfer";
import CouponBox from "../components/CouponBox";
import PaymentButtons from "../components/PaymentButtons";

export default function TransferCheckout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    API.get(`/transfers/${id}`)
      .then((r) => setBooking(r.data.data))
      .catch((e) => setError(e.response?.data?.message || "Không thể tải đơn đặt xe."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (booking?.status !== "Pending") return undefined;
    const expiry = new Date(booking.expiresAt).getTime();
    const tick = () => {
      const s = Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
      setRemaining(s);
      if (s === 0) {
        API.get(`/transfers/${id}`).catch((e) => {
          setBooking(null);
          setError(e.response?.data?.message || "Đơn đã hết thời gian giữ xe.");
        });
      }
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [booking, id]);


  const cancel = async () => {
    if (!window.confirm("Hủy đơn đặt xe này?")) return;
    setBusy(true);
    try {
      await API.put(`/transfers/${booking._id}/cancel`);
      navigate("/transfers");
    } catch (e) {
      setError(e.response?.data?.message || "Không thể hủy đơn.");
      setBusy(false);
    }
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center font-bold text-[#173b31]">Đang tải đơn đặt xe...</div>;

  if (!booking) {
    return (
      <main className="grid min-h-[60vh] place-items-center bg-[#f7f5ef] px-5">
        <div className="text-center">
          <p role="alert" className="font-semibold text-red-700">{error}</p>
          <Link to="/transfers" className="mt-5 inline-block rounded-xl bg-[#173b31] px-5 py-3 font-bold text-white">Đặt xe khác</Link>
        </div>
      </main>
    );
  }

  const status = TRANSFER_STATUS[booking.status] || TRANSFER_STATUS.Pending;
  const isPending = booking.status === "Pending";
  const rows = [
    ["Tuyến", `${booking.routeId?.fromPlace} → ${booking.routeId?.toPlace}`],
    ["Tỉnh/TP", booking.routeId?.province],
    ["Giờ đón", formatPickup(booking.pickupTime)],
    ["Loại xe", `${booking.vehicleTypeId?.name} · ${booking.vehicles} xe`],
    ["Số khách", booking.passengers],
    ["Nhà xe", `${booking.companyId?.companyName}${booking.companyId?.phone ? ` · ${booking.companyId.phone}` : ""}`],
    ["Chuyến bay", booking.flightNumber || "—"],
    ["SĐT liên hệ", booking.contactPhone],
  ];

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] px-4 py-10 sm:px-5 sm:py-16">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-xl sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-5">
          <h1 className="font-display text-2xl font-bold text-[#173b31] sm:text-3xl">Thanh toán xe đưa đón</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
        </div>

        <dl className="mt-6 grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="font-semibold text-stone-500">{k}</dt>
              <dd className="mt-0.5 font-semibold text-stone-900">{v}</dd>
            </div>
          ))}
        </dl>

        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}

        {isPending ? (
          <>
            <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Xe đang được giữ cho bạn
              {remaining !== null && ` (còn ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")})`}.
              Quá thời gian, đơn tự hủy và xe được mở bán lại.
            </p>
            <div className="mt-5">
              <CouponBox
                kind="transfer"
                orderId={booking._id}
                order={booking}
                onChange={(summary) => setBooking((b) => ({ ...b, ...summary }))}
                disabled={busy || remaining === 0}
              />
            </div>
            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-500">Tổng thanh toán</p>
                {booking.coupon?.code && (
                  <p className="text-sm text-stone-400 line-through">{formatVnd(booking.subtotalAmount ?? booking.totalAmount)}</p>
                )}
                <p className="text-3xl font-extrabold text-[#b7812d]">{formatVnd(booking.totalAmount)}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={cancel} disabled={busy} className="rounded-2xl bg-stone-100 px-6 py-4 font-bold text-stone-600 hover:bg-stone-200 disabled:opacity-60">Hủy đơn</button>
                <PaymentButtons body={{ transferBookingId: booking._id }} disabled={busy || remaining === 0} onError={setError} />
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-3xl font-extrabold text-[#b7812d]">{formatVnd(booking.totalAmount)}</p>
            <Link to="/profile?tab=transfers" className="rounded-2xl bg-[#173b31] px-8 py-4 text-center font-bold text-white hover:bg-[#245a4b]">
              Xem lịch sử đặt xe
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
