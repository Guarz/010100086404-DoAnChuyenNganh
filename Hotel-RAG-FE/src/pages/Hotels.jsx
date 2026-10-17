// File: src/pages/Hotels.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon"; // Hoặc "../common/Icon" tùy thư mục của bạn
import API from "../services/api";

export default function Hotels() {
  const navigate = useNavigate();
  
  // State lưu dữ liệu thật
  const [allHotels, setAllHotels] = useState([]);
  const [loading, setLoading] = useState(true);

  // State bộ lọc
  const [breakfast, setBreakfast] = useState(false);
  const [pool, setPool] = useState(false);
  const [sort, setSort] = useState("Đề xuất");

  // GỌI API KHI VỪA MỞ TRANG
  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const response = await API.get('/hotels');
        if (response.data.success) {
          setAllHotels(response.data.data);
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu khách sạn:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHotels();
  }, []);

  // LỌC DỮ LIỆU ĐỘNG TỪ MONGODB
  const filtered = allHotels.filter((hotel) => {
    // Lọc tiện nghi (Dựa vào mảng amenities thật trong DB)
    if (breakfast && !hotel.amenities?.some(a => a.toLowerCase().includes("sáng"))) return false;
    if (pool && !hotel.amenities?.some(a => a.toLowerCase().includes("bơi"))) return false;
    return true;
  });

  // SẮP XẾP
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "Đánh giá cao") return (b.rating || 0) - (a.rating || 0);
    return 0;
  });

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-[#173b31] font-bold">Đang tải dữ liệu...</div>;
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <button onClick={() => navigate("/")} className="mb-5 flex items-center gap-2 text-sm font-bold text-stone-500 hover:text-[#173b31]">
            ← Quay lại trang chủ
          </button>
          <div className="grid gap-3 rounded-2xl border border-stone-200 p-3 shadow-sm lg:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="rounded-xl bg-stone-50 px-4 py-3"><p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400">Điểm đến</p><p className="mt-1 font-bold">Đà Nẵng</p></div>
            <div className="rounded-xl bg-stone-50 px-4 py-3"><p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400">Ngày lưu trú</p><p className="mt-1 font-bold">21 thg 10 — 24 thg 10</p></div>
            <div className="rounded-xl bg-stone-50 px-4 py-3"><p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400">Khách & phòng</p><p className="mt-1 font-bold">2 khách, 1 phòng</p></div>
            <button className="flex items-center justify-center gap-2 rounded-xl bg-[#173b31] px-7 py-3 font-bold text-white transition hover:bg-[#245a4b]">
              <Icon name="search" /> Tìm lại
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[#b7812d]">Kết quả tìm kiếm</p>
            <h1 className="font-display mt-2 text-4xl font-semibold text-[#173b31]">{sorted.length} chỗ nghỉ phù hợp</h1>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">Sắp xếp
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-full border border-stone-200 bg-white px-4 py-2.5 font-bold outline-none">
              <option>Đề xuất</option><option>Đánh giá cao</option>
            </select>
          </label>
        </div>

        <div className="mt-9 grid gap-9 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-6 lg:sticky lg:top-28">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-[#173b31]">Bộ lọc nhanh</h2>
              <button onClick={() => {  setBreakfast(false); setPool(false); }} className="text-xs font-bold text-[#b7812d]">Đặt lại</button>
            </div>
            <div className="mt-6 border-t border-stone-100 pt-5">
              <p className="text-sm font-bold">Tiện nghi phổ biến</p>
              <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-stone-600"><input type="checkbox" checked={breakfast} onChange={(e) => setBreakfast(e.target.checked)} className="size-4 accent-[#173b31]" /> Bao gồm bữa sáng</label>
              <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm text-stone-600"><input type="checkbox" checked={pool} onChange={(e) => setPool(e.target.checked)} className="size-4 accent-[#173b31]" /> Có Hồ bơi</label>
            </div>
          </aside>

          <section className="grid gap-6 sm:grid-cols-2">
            {sorted.map((hotel) => (
              <article key={hotel._id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                {/* Dùng URL ID thật để chuyển trang */}
                <button onClick={() => navigate(`/hotels/${hotel._id}`)} className="block w-full text-left">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img src={hotel.images[0] || "https://images.unsplash.com/photo-1569335468885-d7d1a41e570c?w=800"} alt={hotel.hotelName} className="size-full object-cover" />
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold">Nestly Lựa chọn</span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-xl font-semibold text-[#173b31]">{hotel.hotelName}</h3>
                        <p className="mt-1 text-sm text-stone-500">{hotel.address?.street}, {hotel.address?.city}</p>
                      </div>
                      <span className="flex items-center gap-1 text-sm font-bold"><span className="text-[#d09b42]">★</span>{hotel.rating || "4.5"}</span>
                    </div>
                    <div className="mt-5 flex items-end justify-between border-t border-stone-100 pt-4">
                      <p className="text-xs text-stone-400">Giá tham khảo</p>
                      {/* Tạm thời hiển thị text cứng, sau này nối bảng RoomType ta sẽ lấy giá thật */}
                      <p><strong className="text-lg">Từ 1.200.000₫</strong></p>
                    </div>
                  </div>
                </button>
              </article>
            ))}
            {sorted.length === 0 && (
              <div className="col-span-full rounded-2xl bg-white p-16 text-center">
                <h3 className="font-display text-2xl text-[#173b31]">Chưa tìm thấy chỗ nghỉ phù hợp</h3>
                <p className="mt-2 text-sm text-stone-500">Hãy thử bỏ bớt một vài bộ lọc.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}