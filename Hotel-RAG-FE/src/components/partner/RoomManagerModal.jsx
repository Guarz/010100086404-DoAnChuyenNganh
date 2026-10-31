// File: src/components/partner/RoomManagerModal.jsx
// Danh sách hạng phòng của 1 khách sạn + sửa từng hạng phòng (thông tin, tiện nghi, ảnh, giá gốc, sức chứa, tổng số phòng).
import { useEffect, useState } from "react";
import Modal from "../Modal";
import AmenityPicker from "../AmenityPicker";
import { ROOM_AMENITY_SUGGESTIONS } from "../../constants/amenities";
import API from "../../services/api";

const inputClass = "mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-[#173b31]";

function RoomForm({ room, onCancel, onSaved }) {
  const [form, setForm] = useState({
    title: room.title || "",
    description: room.description || "",
    basePrice: room.basePrice ?? "",
    totalQuantity: room.totalQuantity ?? 1,
    maxAdults: room.maxAdults ?? 2,
    maxChildren: room.maxChildren ?? 0,
    images: (room.images || []).join("\n"),
  });
  const [amenities, setAmenities] = useState(room.amenities || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await API.put(`/partner/rooms/${room._id}`, {
        title: form.title,
        description: form.description,
        basePrice: Number(form.basePrice),
        totalQuantity: Number(form.totalQuantity),
        maxAdults: Number(form.maxAdults),
        maxChildren: Number(form.maxChildren),
        amenities,
        images: form.images.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      onSaved(response.data.data, response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể lưu hạng phòng.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-3">
      <label className="block text-sm font-bold text-stone-700 sm:col-span-2">
        Tên hạng phòng
        <input name="title" value={form.title} onChange={change} required minLength={2} className={inputClass} />
      </label>
      <label className="block text-sm font-bold text-stone-700">
        Giá gốc (VNĐ)
        <input name="basePrice" type="number" min="1000" value={form.basePrice} onChange={change} required className={inputClass} />
      </label>
      <label className="block text-sm font-bold text-stone-700">
        Tổng số phòng
        <input name="totalQuantity" type="number" min="1" value={form.totalQuantity} onChange={change} required className={inputClass} />
      </label>
      <label className="block text-sm font-bold text-stone-700">
        Người lớn tối đa
        <input name="maxAdults" type="number" min="1" value={form.maxAdults} onChange={change} required className={inputClass} />
      </label>
      <label className="block text-sm font-bold text-stone-700">
        Trẻ em tối đa
        <input name="maxChildren" type="number" min="0" value={form.maxChildren} onChange={change} className={inputClass} />
      </label>
      {Number(form.totalQuantity) !== room.totalQuantity && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 sm:col-span-3">
          Đổi tổng số phòng sẽ cộng/trừ phần chênh lệch vào số phòng trống của các ngày từ hôm nay (giữ nguyên các phòng đã được đặt).
        </p>
      )}
      <label className="block text-sm font-bold text-stone-700 sm:col-span-3">
        Mô tả phòng
        <textarea name="description" value={form.description} onChange={change} rows="2" className={inputClass} />
      </label>
      <div className="sm:col-span-3">
        <AmenityPicker label="Tiện nghi phòng" value={amenities} onChange={setAmenities} suggestions={ROOM_AMENITY_SUGGESTIONS} />
      </div>
      <label className="block text-sm font-bold text-stone-700 sm:col-span-3">
        Link ảnh phòng (mỗi ảnh 1 dòng)
        <textarea name="images" value={form.images} onChange={change} rows="3" className={`${inputClass} text-xs`} />
      </label>
      {error && <p role="alert" className="text-sm font-bold text-red-600 sm:col-span-3">{error}</p>}
      <div className="flex flex-col-reverse gap-3 border-t border-stone-100 pt-5 sm:col-span-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-xl px-6 py-3 font-bold text-stone-500 hover:bg-stone-100">
          Quay lại danh sách
        </button>
        <button type="submit" disabled={saving} className="rounded-xl bg-[#173b31] px-6 py-3 font-bold text-white hover:bg-[#245a4b] disabled:opacity-60">
          {saving ? "Đang lưu..." : "Lưu hạng phòng"}
        </button>
      </div>
    </form>
  );
}

export default function RoomManagerModal({ hotel, onClose }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let ignore = false;
    API.get(`/hotels/${hotel._id}/rooms?showAll=true`)
      .then((res) => !ignore && setRooms(res.data.data))
      .catch((err) => !ignore && setError(err.response?.data?.message || "Không thể tải hạng phòng."))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [hotel._id]);

  const onSaved = (updated, text) => {
    setRooms((current) => current.map((r) => (r._id === updated._id ? updated : r)));
    setEditing(null);
    setMessage(text);
  };

  return (
    <Modal
      title={editing ? `Sửa: ${editing.title}` : "Hạng phòng"}
      subtitle={hotel.hotelName}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      {editing ? (
        <RoomForm room={editing} onCancel={() => setEditing(null)} onSaved={onSaved} />
      ) : loading ? (
        <p className="py-10 text-center text-sm text-stone-500">Đang tải hạng phòng...</p>
      ) : error ? (
        <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>
      ) : rooms.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500">Khách sạn chưa có hạng phòng nào.</p>
      ) : (
        <div className="space-y-4">
          {message && (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>
          )}
          {rooms.map((room) => (
            <article key={room._id} className="flex flex-col gap-4 rounded-2xl border border-stone-200 p-4 sm:flex-row">
              <img
                src={room.images?.[0] || "https://images.unsplash.com/photo-1569335468885-d7d1a41e570c?w=400"}
                alt={room.title}
                className="h-32 w-full rounded-xl object-cover sm:h-24 sm:w-32"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-[#173b31]">{room.title}</h3>
                  {room.isActive === false && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">BẢO TRÌ</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-stone-500">
                  {room.basePrice?.toLocaleString("vi-VN")}₫/đêm · {room.totalQuantity} phòng · {room.maxAdults} NL, {room.maxChildren ?? 0} TE
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(room.amenities || []).length ? (
                    room.amenities.map((a) => (
                      <span key={a} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">{a}</span>
                    ))
                  ) : (
                    <span className="text-xs italic text-stone-400">Chưa khai báo tiện nghi</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessage("");
                  setEditing(room);
                }}
                className="self-start rounded-full border border-stone-200 px-4 py-2 text-sm font-bold hover:bg-stone-50"
              >
                Sửa
              </button>
            </article>
          ))}
        </div>
      )}
    </Modal>
  );
}
