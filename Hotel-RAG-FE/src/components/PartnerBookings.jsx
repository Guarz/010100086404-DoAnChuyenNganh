// File: src/components/PartnerBookings.jsx
// Bảng quản lý đơn đặt phòng cho Partner: biết khách nào sắp Check-in / Check-out để chuẩn bị buồng.
import { useEffect, useState } from "react";
import Icon from "./Icon";
import API from "../services/api";

const DAY_MS = 24 * 60 * 60 * 1000;

// Quy về nửa đêm giờ địa phương để so sánh theo ngày
const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const VIEWS = [
  { id: "arrivals", label: "Nhận phòng hôm nay" },
  { id: "departures", label: "Trả phòng hôm nay" },
  { id: "inhouse", label: "Đang lưu trú" },
  { id: "upcoming", label: "Sắp đến (7 ngày)" },
  { id: "all", label: "Tất cả đơn" },
];

const STATUS_BADGE = {
  Confirmed: { label: "Đã thanh toán", className: "bg-emerald-50 text-emerald-700" },
  Completed: { label: "Đã trả phòng", className: "bg-sky-50 text-sky-700" },
  Canceled: { label: "Đã hủy", className: "bg-red-50 text-red-700" },
  Pending: { label: "Chờ thanh toán", className: "bg-amber-50 text-amber-800" },
};

const matchesView = (booking, view, today) => {
  if (view === "all") return true;
  if (booking.bookingStatus !== "Confirmed") return false;

  const checkIn = startOfDay(booking.checkInDate);
  const checkOut = startOfDay(booking.checkOutDate);

  switch (view) {
    case "arrivals":
      return checkIn === today;
    case "departures":
      return checkOut === today;
    case "inhouse":
      return checkIn < today && checkOut > today;
    case "upcoming":
      return checkIn > today && checkIn <= today + 7 * DAY_MS;
    default:
      return true;
  }
};

export default function PartnerBookings({ onSummaryChange }) {
  const [bookings, setBookings] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [summary, setSummary] = useState(null);
  const [hotelId, setHotelId] = useState("");
  const [view, setView] = useState("arrivals");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [completingId, setCompletingId] = useState("");

  const loadBookings = async (selectedHotelId = hotelId) => {
    setLoading(true);
    setError("");
    try {
      const response = await API.get("/partner/bookings", {
        params: selectedHotelId ? { hotelId: selectedHotelId } : {},
      });
      setBookings(response.data.data);
      setSummary(response.data.summary);
      if (!selectedHotelId) setHotels(response.data.hotels);
      onSummaryChange?.(response.data.summary);
    } catch (err) {
      setError(
        err.response?.data?.message || "Không thể tải danh sách đơn đặt phòng.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBookings("");
  }, []);

  const handleComplete = async (booking) => {
    if (
      !window.confirm(
        `Xác nhận khách ${booking.customerId?.fullName || ""} đã trả phòng?`,
      )
    ) {
      return;
    }
    setCompletingId(booking._id);
    setError("");
    try {
      const response = await API.put(`/partner/bookings/${booking._id}/complete`);
      setMessage(response.data.message);
      await loadBookings();
    } catch (err) {
      setError(err.response?.data?.message || "Không thể cập nhật đơn.");
    } finally {
      setCompletingId("");
    }
  };

  const today = startOfDay(new Date());
  const keyword = search.trim().toLocaleLowerCase("vi");
  const visible = bookings.filter((booking) => {
    if (!matchesView(booking, view, today)) return false;
    if (view === "all" && statusFilter !== "all" && booking.bookingStatus !== statusFilter) {
      return false;
    }
    if (!keyword) return true;
    return [
      booking.customerId?.fullName,
      booking.customerId?.phone,
      booking.customerId?.email,
      booking._id.slice(-6),
    ]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase("vi").includes(keyword));
  });

  const viewCount = (id) =>
    bookings.filter((booking) => matchesView(booking, id, today)).length;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-stone-100 p-5 sm:flex-row sm:items-end sm:p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#173b31]">
            Đơn đặt phòng
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {summary
              ? `Hôm nay cần chuẩn bị ${summary.roomsToPrepareToday} phòng cho ${summary.arrivalsToday} lượt khách đến · ${summary.departuresToday} lượt trả phòng`
              : "Theo dõi lịch nhận / trả phòng của khách"}
          </p>
        </div>
        <div className="flex min-w-0 gap-2">
          <select
            value={hotelId}
            onChange={(e) => {
              setHotelId(e.target.value);
              loadBookings(e.target.value);
            }}
            aria-label="Lọc theo khách sạn"
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#173b31] sm:flex-none"
          >
            <option value="">Tất cả khách sạn</option>
            {hotels.map((hotel) => (
              <option key={hotel._id} value={hotel._id}>
                {hotel.hotelName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadBookings()}
            disabled={loading}
            className="shrink-0 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
          >
            Tải lại
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-stone-100 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                view === item.id
                  ? "bg-[#173b31] text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {item.label}{" "}
              <span className={view === item.id ? "text-white/70" : "text-stone-400"}>
                {viewCount(item.id)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex min-w-0 gap-2">
          {view === "all" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Lọc theo trạng thái"
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold outline-none"
            >
              <option value="all">Mọi trạng thái</option>
              <option value="Confirmed">Đã thanh toán</option>
              <option value="Completed">Đã trả phòng</option>
              <option value="Canceled">Đã hủy</option>
            </select>
          )}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tên, SĐT, mã đơn..."
            aria-label="Tìm đơn"
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs outline-none focus:border-[#173b31] lg:w-52"
          />
        </div>
      </div>

      {message && (
        <div className="mx-6 mt-4 flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          <span className="flex items-center gap-2">
            <Icon name="check" /> {message}
          </span>
          <button type="button" onClick={() => setMessage("")}>
            Đóng
          </button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-14 text-center text-sm text-stone-500">
          Đang tải đơn đặt phòng...
        </div>
      ) : visible.length === 0 ? (
        <div className="p-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-stone-100 text-stone-400">
            <Icon name="calendar" size={22} />
          </span>
          <p className="mt-3 text-sm font-bold text-stone-500">
            Không có đơn nào trong mục này.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-6 py-3 font-bold">Khách</th>
                <th className="px-6 py-3 font-bold">Phòng</th>
                <th className="px-6 py-3 font-bold">Lịch lưu trú</th>
                <th className="px-6 py-3 font-bold">Tổng tiền</th>
                <th className="px-6 py-3 font-bold">Trạng thái</th>
                <th className="px-6 py-3 text-right font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((booking) => {
                const checkIn = startOfDay(booking.checkInDate);
                const checkOut = startOfDay(booking.checkOutDate);
                const nights = Math.round((checkOut - checkIn) / DAY_MS);
                const badge = STATUS_BADGE[booking.bookingStatus] || STATUS_BADGE.Pending;
                const canComplete =
                  booking.bookingStatus === "Confirmed" && checkIn <= today;
                const daysUntil = Math.round((checkIn - today) / DAY_MS);

                return (
                  <tr key={booking._id} className="align-top">
                    <td className="px-6 py-4">
                      <p className="font-bold text-stone-900">
                        {booking.customerId?.fullName || "Khách vãng lai"}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {booking.customerId?.phone || booking.customerId?.email || "—"}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-stone-400">
                        #{booking._id.slice(-6).toUpperCase()}
                        {!hotelId && hotels.length > 1 && ` · ${booking.hotelId?.hotelName}`}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {booking.bookingDetails.map((detail) => (
                        <p key={detail._id} className="text-stone-700">
                          <strong className="text-[#b7812d]">{detail.quantity}×</strong>{" "}
                          {detail.roomTypeId?.title || "Hạng phòng"}
                        </p>
                      ))}
                      {booking.specialRequests && (
                        <p className="mt-2 max-w-[220px] rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
                          Yêu cầu: {booking.specialRequests}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-stone-600">
                      <p>
                        <span className="text-xs text-stone-400">Nhận:</span>{" "}
                        <strong>{new Date(booking.checkInDate).toLocaleDateString("vi-VN")}</strong>
                      </p>
                      <p className="mt-1">
                        <span className="text-xs text-stone-400">Trả:</span>{" "}
                        <strong>{new Date(booking.checkOutDate).toLocaleDateString("vi-VN")}</strong>
                      </p>
                      <p className="mt-1 text-xs text-stone-400">
                        {nights} đêm
                        {booking.bookingStatus === "Confirmed" && daysUntil > 0 &&
                          ` · còn ${daysUntil} ngày`}
                      </p>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#173b31]">
                      {booking.totalAmount.toLocaleString("vi-VN")}₫
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canComplete ? (
                        <button
                          type="button"
                          onClick={() => handleComplete(booking)}
                          disabled={completingId === booking._id}
                          className="rounded-full bg-[#173b31] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#245a4b] disabled:opacity-60"
                        >
                          {completingId === booking._id ? "Đang xử lý..." : "Xác nhận trả phòng"}
                        </button>
                      ) : (
                        <span className="text-xs text-stone-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
