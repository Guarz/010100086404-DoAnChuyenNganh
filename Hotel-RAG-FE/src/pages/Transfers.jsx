// File: src/pages/Transfers.jsx
// Khách tìm và đặt xe đưa đón (sân bay <-> khách sạn, nội thành).
// Query params hỗ trợ: ?province=&date=&passengers=&hotelId=&hotelBookingId= (đi từ trang khách sạn / đơn phòng)
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../services/api";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import { formatVnd, newIdempotencyKey, vnDateKey } from "../constants/transfer";
import ProvinceSelect from "../components/ProvinceSelect";
import useProvinceCounts from "../hooks/useProvinceCounts";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#173b31]";

function BookingModal({ option, date, passengers, hotelBookingId, onClose }) {
  const navigate = useNavigate();
  const keyRef = useRef(newIdempotencyKey()); // 1 khóa cho 1 lần mở form -> bấm 2 lần không tạo 2 đơn
  const storedUser = JSON.parse(localStorage.getItem("nestly_user") || "null");
  const [form, setForm] = useState({
    time: "10:00",
    flightNumber: "",
    contactPhone: storedUser?.phone || "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!localStorage.getItem("nestly_token")) {
      navigate("/login");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await API.post(
        "/transfers",
        {
          routeId: option.routeId,
          pickupTime: `${date}T${form.time}`,
          passengers,
          flightNumber: form.flightNumber,
          contactPhone: form.contactPhone.trim(),
          note: form.note,
          hotelBookingId: hotelBookingId || undefined,
        },
        { headers: { "Idempotency-Key": keyRef.current } },
      );
      navigate(`/transfer-checkout/${res.data.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể đặt xe lúc này.");
      // Lỗi nghiệp vụ (hết xe, sai dữ liệu) -> lần gửi sau là yêu cầu mới
      if (err.response?.status === 400) keyRef.current = newIdempotencyKey();
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Đặt xe đưa đón" subtitle={`${option.fromPlace} → ${option.toPlace}`} onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-2xl bg-[#f2f7f5] p-4 text-sm">
          <p className="font-bold text-[#173b31]">{option.vehicle.name} · {option.company.companyName}</p>
          <p className="mt-1 text-stone-600">
            Ngày {new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN")} · {passengers} khách · {option.vehiclesNeeded} xe
          </p>
          <p className="mt-2 text-lg font-extrabold text-[#b7812d]">{formatVnd(option.totalPrice)}</p>
        </div>
        <label className="block text-sm font-semibold text-stone-700">
          Giờ đón
          <input type="time" required value={form.time} onChange={set("time")} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Số hiệu chuyến bay (nếu đón sân bay)
          <input value={form.flightNumber} onChange={set("flightNumber")} maxLength={20} placeholder="VD: VN123" className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Số điện thoại liên hệ
          <input required value={form.contactPhone} onChange={set("contactPhone")} inputMode="tel" placeholder="0905xxxxxx" className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          Ghi chú cho tài xế
          <textarea value={form.note} onChange={set("note")} maxLength={500} rows={2} className={`${inputClass} mt-1`} />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <p className="text-xs text-stone-500">Xe được giữ 5 phút để bạn thanh toán qua VNPay. Đặt trước giờ đón ít nhất 1 tiếng.</p>
        <button disabled={submitting} className="w-full rounded-2xl bg-[#173b31] py-3.5 font-bold text-white hover:bg-[#245a4b] disabled:opacity-60">
          {submitting ? "Đang giữ xe..." : "Giữ xe & thanh toán"}
        </button>
      </form>
    </Modal>
  );
}

export default function Transfers() {
  const [params, setParams] = useSearchParams();
  const routeCounts = useProvinceCounts("/transfers/provinces", "routeCount");
  const [province, setProvince] = useState(params.get("province") || "");
  const [date, setDate] = useState(params.get("date") || vnDateKey(1));
  const [passengers, setPassengers] = useState(Number(params.get("passengers")) || 2);
  const hotelId = params.get("hotelId");
  const hotelBookingId = params.get("hotelBookingId");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(params.get("province") || params.get("hotelId")));
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const fetchResults = (q) =>
    API.get("/transfers/search", {
      params: { province: q.hotelId ? undefined : q.province || undefined, hotelId: q.hotelId || undefined, date: q.date, passengers: q.passengers },
    })
      .then((res) => {
        setResults(res.data.data);
        if (res.data.province) setProvince(res.data.province);
        setSearched(true);
        setError("");
      })
      .catch((err) => setError(err.response?.data?.message || "Không thể tìm xe lúc này."))
      .finally(() => setLoading(false));

  const search = (overrides = {}) => {
    setLoading(true);
    fetchResults({ province, date, passengers, hotelId, ...overrides });
  };

  useEffect(() => {
    // Đi từ trang khách sạn / đơn phòng -> tìm ngay
    if (params.get("province") || hotelId) fetchResults({ province, date, passengers, hotelId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    // Đổi tỉnh thủ công -> bỏ liên kết khách sạn
    const next = { province, date, passengers: String(passengers) };
    if (hotelBookingId) next.hotelBookingId = hotelBookingId;
    setParams(next, { replace: true });
    search({ hotelId: null });
  };

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] pb-16">
      <section className="bg-[#173b31] px-5 pb-24 pt-12 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-bold uppercase tracking-widest text-[#e3c27a]">Xe đưa đón</p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Đón sân bay, về khách sạn thật nhẹ nhàng</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Đặt xe riêng từ các nhà xe đã được Nestly kiểm duyệt. Giá trọn gói theo xe, không phát sinh.
          </p>
          {hotelBookingId && (
            <p className="mt-4 inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold">
              Đặt kèm đơn phòng #{hotelBookingId.slice(-6).toUpperCase()}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto -mt-16 max-w-5xl px-5">
        <form onSubmit={onSubmit} className="grid gap-3 rounded-3xl bg-white p-5 shadow-xl sm:grid-cols-[1.4fr_1fr_0.8fr_auto] sm:items-end">
          <label className="text-sm font-semibold text-stone-600">
            Tỉnh/TP
            <ProvinceSelect
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              counts={routeCounts}
              countUnit=" tuyến"
              placeholder="Chọn tỉnh/thành"
              required
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold text-stone-600">
            Ngày đón
            <input type="date" value={date} min={vnDateKey(0)} onChange={(e) => setDate(e.target.value)} required className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm font-semibold text-stone-600">
            Số khách
            <input type="number" min={1} max={100} value={passengers} onChange={(e) => setPassengers(Math.max(1, Number(e.target.value) || 1))} className={`${inputClass} mt-1`} />
          </label>
          <button className="flex items-center justify-center gap-2 rounded-xl bg-[#d4a34f] px-6 py-3 font-bold text-white hover:bg-[#b7812d]">
            <Icon name="search" /> Tìm xe
          </button>
        </form>

        {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 font-semibold text-red-700">{error}</p>}
        {loading && <p className="mt-8 text-center font-semibold text-stone-500">Đang tìm xe...</p>}

        {!loading && searched && results.length === 0 && (
          <div className="mt-8 rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <p className="font-bold text-stone-700">Chưa có xe phù hợp {province && `tại ${province}`} vào ngày này</p>
            <p className="mt-1 text-sm text-stone-500">Thử đổi ngày, giảm số khách hoặc chọn thành phố khác.</p>
          </div>
        )}

        <div className="mt-8 grid gap-4">
          {!loading &&
            results.map((o) => (
              <article key={o.routeId} className="flex flex-col gap-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#f1eee6] text-[#b7812d]">
                  {o.vehicle.images?.[0] ? (
                    <img src={o.vehicle.images[0]} alt={o.vehicle.name} className="size-full object-cover" />
                  ) : (
                    <Icon name="car" size={30} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-400">{o.company.companyName}</p>
                  <h2 className="mt-0.5 text-lg font-bold text-[#173b31]">{o.fromPlace} → {o.toPlace}</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    {o.vehicle.name} · {o.vehicle.seats} chỗ · {o.vehicle.luggage} vali · ~{o.durationMin} phút
                  </p>
                  {o.vehicle.amenities?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {o.vehicle.amenities.slice(0, 4).map((a) => (
                        <span key={a} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-stone-100 pt-4 sm:block sm:border-0 sm:pt-0 sm:text-right">
                  <div>
                    <p className="text-xl font-extrabold text-[#b7812d]">{formatVnd(o.totalPrice)}</p>
                    <p className="text-xs text-stone-500">
                      {o.vehiclesNeeded > 1 ? `${o.vehiclesNeeded} xe × ${formatVnd(o.price)}` : "trọn gói / xe"} · còn {o.availableVehicles} xe
                    </p>
                  </div>
                  <button onClick={() => setSelected(o)} className="rounded-xl bg-[#173b31] px-5 py-2.5 font-bold text-white hover:bg-[#245a4b] sm:mt-3">
                    Đặt xe
                  </button>
                </div>
              </article>
            ))}
        </div>
      </div>

      {selected && (
        <BookingModal option={selected} date={date} passengers={passengers} hotelBookingId={hotelBookingId} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}
