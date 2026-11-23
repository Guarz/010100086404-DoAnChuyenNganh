// File: src/components/WishlistPanel.jsx - tab "Yêu thích" trong trang Tài khoản
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import WishlistButton from "./WishlistButton";
import useWishlist from "../hooks/useWishlist";

export default function WishlistPanel() {
  const ids = useWishlist();
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get("/users/me/wishlist")
      .then((r) => setHotels(r.data.data))
      .catch((e) => setError(e.response?.data?.message || "Không thể tải danh sách yêu thích."))
      .finally(() => setLoading(false));
  }, []);

  // Bỏ trái tim ở đây thì ẩn luôn khỏi danh sách
  const visible = hotels.filter((h) => ids.has(String(h._id)));

  return (
    <section>
      <h2 className="text-2xl font-extrabold text-slate-900">Khách sạn yêu thích</h2>
      <p className="mt-2 text-sm text-slate-500">Bấm hình trái tim trên thẻ khách sạn để lưu lại xem sau.</p>
      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Đang tải...</p>
      ) : error ? (
        <p role="alert" className="mt-8 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>
      ) : visible.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 p-10 text-center">
          <p className="font-bold text-slate-700">Chưa có khách sạn yêu thích</p>
          <Link to="/hotels" className="mt-4 inline-block rounded-xl bg-[#173b31] px-5 py-3 text-sm font-bold text-white hover:bg-[#245a4b]">
            Tìm khách sạn
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {visible.map((h) => (
            <div key={h._id} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <Link to={`/hotels/${h._id}`} className="block">
                <img src={h.images?.[0]} alt={h.hotelName} loading="lazy" className="aspect-[16/10] w-full object-cover" />
                <div className="p-4">
                  <p className="font-bold text-[#173b31]">{h.hotelName}</p>
                  <p className="mt-1 text-sm text-slate-500">{[h.address?.city, h.address?.province].filter(Boolean).join(", ")}</p>
                </div>
              </Link>
              <WishlistButton
                hotelId={h._id}
                hotelName={h.hotelName}
                className="absolute right-3 top-3 size-10 rounded-full bg-white/90 shadow hover:bg-white"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
