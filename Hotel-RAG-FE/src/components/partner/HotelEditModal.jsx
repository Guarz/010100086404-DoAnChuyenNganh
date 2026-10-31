// File: src/components/partner/HotelEditModal.jsx
// Partner sửa thông tin khách sạn: tên, mô tả, địa chỉ, tiện nghi, ảnh.
import { useState } from "react";
import Modal from "../Modal";
import AmenityPicker from "../AmenityPicker";
import { HOTEL_AMENITY_SUGGESTIONS } from "../../constants/amenities";
import API from "../../services/api";

const inputClass = "mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-[#173b31]";

export default function HotelEditModal({ hotel, onClose, onSaved }) {
  const [form, setForm] = useState({
    hotelName: hotel.hotelName || "",
    description: hotel.description || "",
    street: hotel.address?.street || "",
    city: hotel.address?.city || "",
    province: hotel.address?.province || "",
    images: (hotel.images || []).join("\n"),
  });
  const [amenities, setAmenities] = useState(hotel.amenities || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await API.put(`/partner/hotels/${hotel._id}`, {
        hotelName: form.hotelName,
        description: form.description,
        address: { street: form.street, city: form.city, province: form.province },
        amenities,
        images: form.images.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      onSaved(response.data.data, response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể lưu thay đổi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Sửa thông tin khách sạn" subtitle={hotel.hotelName} onClose={onClose} maxWidth="max-w-3xl">
      {hotel.status === "Rejected" && (
        <p className="mb-5 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Hồ sơ đang bị từ chối{hotel.rejectionReason ? `: ${hotel.rejectionReason}` : ""}. Lưu thay đổi sẽ gửi lại cho Admin duyệt.
        </p>
      )}
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-bold text-stone-700 sm:col-span-2">
          Tên khách sạn
          <input name="hotelName" value={form.hotelName} onChange={change} required minLength={2} className={inputClass} />
        </label>
        <label className="block text-sm font-bold text-stone-700 sm:col-span-2">
          Mô tả
          <textarea name="description" value={form.description} onChange={change} required minLength={10} rows="4" className={inputClass} />
        </label>
        <label className="block text-sm font-bold text-stone-700">
          Tỉnh/TP
          <input name="province" value={form.province} onChange={change} required className={inputClass} />
        </label>
        <label className="block text-sm font-bold text-stone-700">
          Quận/Thành phố
          <input name="city" value={form.city} onChange={change} required className={inputClass} />
        </label>
        <label className="block text-sm font-bold text-stone-700 sm:col-span-2">
          Địa chỉ cụ thể
          <input name="street" value={form.street} onChange={change} required className={inputClass} />
        </label>
        <div className="sm:col-span-2">
          <AmenityPicker label="Tiện nghi khách sạn" value={amenities} onChange={setAmenities} suggestions={HOTEL_AMENITY_SUGGESTIONS} />
        </div>
        <label className="block text-sm font-bold text-stone-700 sm:col-span-2">
          Link hình ảnh (mỗi link 1 dòng)
          <textarea name="images" value={form.images} onChange={change} rows="3" className={`${inputClass} text-xs`} />
        </label>
        {error && <p role="alert" className="text-sm font-bold text-red-600 sm:col-span-2">{error}</p>}
        <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-5 sm:col-span-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl px-6 py-3 font-bold text-stone-500 hover:bg-stone-100">
            Hủy
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-[#173b31] px-6 py-3 font-bold text-white hover:bg-[#245a4b] disabled:opacity-60">
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
