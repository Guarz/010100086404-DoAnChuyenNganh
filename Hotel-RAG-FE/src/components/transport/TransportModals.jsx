// File: src/components/transport/TransportModals.jsx
// Các form của Trung tâm nhà xe: loại xe, tuyến đưa đón, số xe trống theo ngày.
import { useEffect, useState } from "react";
import API from "../../services/api";
import Modal from "../Modal";
import AmenityPicker from "../AmenityPicker";
import ProvinceSelect from "../ProvinceSelect";
import { VEHICLE_AMENITIES, vnDateKey } from "../../constants/transfer";

const inputClass =
  "mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#173b31]";
const labelClass = "block text-sm font-semibold text-stone-700";
const Err = ({ children }) =>
  children ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{children}</p> : null;
const SaveButton = ({ busy, children }) => (
  <button disabled={busy} className="w-full rounded-2xl bg-[#173b31] py-3.5 font-bold text-white hover:bg-[#245a4b] disabled:opacity-60">
    {busy ? "Đang lưu..." : children}
  </button>
);

// Gửi form chung: gọi API, báo lỗi, đóng modal khi xong
const useSubmit = (onDone) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (request) => {
    setBusy(true);
    setError("");
    try {
      const res = await request();
      setBusy(false);
      onDone(res.data.message);
    } catch (e) {
      setError(e.response?.data?.message || "Không thể lưu lúc này.");
      setBusy(false);
    }
  };
  return { busy, error, run };
};

// ----- Loại xe (thêm / sửa) -----
export function VehicleModal({ vehicle, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: vehicle?.name || "",
    seats: vehicle?.seats || 4,
    luggage: vehicle?.luggage ?? 2,
    totalVehicles: vehicle?.totalVehicles || 1,
    amenities: vehicle?.amenities || ["Điều hòa"],
    images: (vehicle?.images || []).join("\n"),
  });
  const { busy, error, run } = useSubmit(onSaved);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const body = {
      ...form,
      seats: Number(form.seats),
      luggage: Number(form.luggage),
      totalVehicles: Number(form.totalVehicles),
      images: form.images.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    run(() => (vehicle ? API.put(`/transport/vehicles/${vehicle._id}`, body) : API.post("/transport/vehicles", body)));
  };

  return (
    <Modal title={vehicle ? "Sửa loại xe" : "Thêm loại xe"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className={labelClass}>Tên loại xe
          <input required minLength={2} value={form.name} onChange={set("name")} placeholder="VD: Sedan 4 chỗ, Ford Transit 16 chỗ" className={inputClass} />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className={labelClass}>Số chỗ
            <input type="number" min={1} max={60} required value={form.seats} onChange={set("seats")} className={inputClass} />
          </label>
          <label className={labelClass}>Số vali
            <input type="number" min={0} max={60} value={form.luggage} onChange={set("luggage")} className={inputClass} />
          </label>
          <label className={labelClass}>Tổng số xe
            <input type="number" min={1} max={500} required value={form.totalVehicles} onChange={set("totalVehicles")} className={inputClass} />
          </label>
        </div>
        {vehicle && (
          <p className="text-xs text-stone-500">Đổi tổng số xe sẽ cộng/trừ phần chênh lệch vào số xe trống từ hôm nay trở đi.</p>
        )}
        <AmenityPicker value={form.amenities} onChange={(amenities) => setForm((f) => ({ ...f, amenities }))} suggestions={VEHICLE_AMENITIES} />
        <label className={labelClass}>Ảnh xe (mỗi dòng 1 URL)
          <textarea rows={2} value={form.images} onChange={set("images")} className={`${inputClass} text-xs`} />
        </label>
        <Err>{error}</Err>
        <SaveButton busy={busy}>{vehicle ? "Lưu thay đổi" : "Thêm loại xe (mở lịch 60 ngày)"}</SaveButton>
      </form>
    </Modal>
  );
}

// ----- Tuyến đưa đón (thêm / sửa) -----
export function RouteModal({ vehicle, route, provinces = [], onClose, onSaved }) {
  const [form, setForm] = useState({
    province: route?.province || provinces[0] || "",
    fromPlace: route?.fromPlace || "",
    toPlace: route?.toPlace || "",
    price: route?.price || 200000,
    durationMin: route?.durationMin || 30,
  });
  const { busy, error, run } = useSubmit(onSaved);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const body = { ...form, price: Number(form.price), durationMin: Number(form.durationMin) };
    run(() => (route ? API.put(`/transport/routes/${route._id}`, body) : API.post(`/transport/vehicles/${vehicle._id}/routes`, body)));
  };

  return (
    <Modal title={route ? "Sửa tuyến" : "Thêm tuyến"} subtitle={vehicle.name} onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <label className={labelClass}>Tỉnh/TP
          <ProvinceSelect required options={provinces} value={form.province} onChange={set("province")} className={`${inputClass} bg-white`} />
          <span className="mt-1 block text-xs font-normal text-stone-500">Chỉ các tỉnh/thành đã đăng ký trong hồ sơ nhà xe.</span>
        </label>
        <label className={labelClass}>Điểm đón
          <input required minLength={2} value={form.fromPlace} onChange={set("fromPlace")} placeholder="VD: Sân bay Đà Nẵng" className={inputClass} />
        </label>
        <label className={labelClass}>Điểm trả
          <input required minLength={2} value={form.toPlace} onChange={set("toPlace")} placeholder="VD: Khách sạn khu Mỹ Khê" className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>Giá / xe / chuyến (₫)
            <input type="number" min={10000} step={1000} required value={form.price} onChange={set("price")} className={inputClass} />
          </label>
          <label className={labelClass}>Thời gian (phút)
            <input type="number" min={5} max={1440} value={form.durationMin} onChange={set("durationMin")} className={inputClass} />
          </label>
        </div>
        <Err>{error}</Err>
        <SaveButton busy={busy}>{route ? "Lưu tuyến" : "Thêm tuyến"}</SaveButton>
      </form>
    </Modal>
  );
}

// ----- Số xe trống theo ngày -----
export function InventoryModal({ vehicle, onClose, onSaved }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ startDate: vnDateKey(0), endDate: vnDateKey(6), availableVehicles: vehicle.totalVehicles });
  const load = () =>
    API.get(`/transport/vehicles/${vehicle._id}/inventory`, { params: { startDate: vnDateKey(0), endDate: vnDateKey(13) } })
      .then((r) => setDays(r.data.data))
      .finally(() => setLoading(false));
  const { busy, error, run } = useSubmit((msg) => {
    load();
    onSaved(msg, false);
  });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle._id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    run(() => API.put(`/transport/vehicles/${vehicle._id}/inventory`, { ...form, availableVehicles: Number(form.availableVehicles) }));
  };

  return (
    <Modal title="Lịch xe trống" subtitle={`${vehicle.name} · tổng ${vehicle.totalVehicles} xe`} onClose={onClose}>
      <p className="text-sm font-bold text-stone-700">14 ngày tới</p>
      {loading ? (
        <p className="mt-3 text-sm text-stone-500">Đang tải...</p>
      ) : (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {days.map((d) => {
            const left = d.availableVehicles;
            return (
              <div key={d.date} className={`rounded-xl p-2 text-center ${left === 0 ? "bg-red-50 text-red-700" : "bg-[#f2f7f5] text-[#173b31]"}`}>
                <p className="text-[11px] font-semibold">{new Date(d.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}</p>
                <p className="text-lg font-extrabold">{left}</p>
              </div>
            );
          })}
        </div>
      )}
      <form onSubmit={submit} className="mt-6 space-y-4 border-t border-stone-100 pt-5">
        <p className="text-sm font-bold text-stone-700">Đặt số xe trống cho một khoảng ngày (VD: xe bảo dưỡng, nghỉ lễ)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>Từ ngày
            <input type="date" required value={form.startDate} min={vnDateKey(0)} onChange={set("startDate")} className={inputClass} />
          </label>
          <label className={labelClass}>Đến ngày
            <input type="date" required value={form.endDate} min={form.startDate} onChange={set("endDate")} className={inputClass} />
          </label>
          <label className={labelClass}>Số xe trống
            <input type="number" min={0} max={vehicle.totalVehicles} required value={form.availableVehicles} onChange={set("availableVehicles")} className={inputClass} />
          </label>
        </div>
        <Err>{error}</Err>
        <SaveButton busy={busy}>Cập nhật lịch</SaveButton>
      </form>
    </Modal>
  );
}
