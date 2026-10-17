// File: src/pages/PartnerDashboard.jsx
import { useState } from "react";
import Icon from "../components/Icon"; // Hoặc "../components/Icon"
import StatCard from "../components/StatCard";

const photos = {
  anam: "https://images.unsplash.com/photo-1596178065887-1198b6148b2b?auto=format&fit=crop&w=900&q=85",
  city: "https://images.unsplash.com/photo-1772006807170-5750a2aa3713?auto=format&fit=crop&w=900&q=85",
};

export default function PartnerDashboard() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold text-[#b7812d]">TRUNG TÂM ĐỐI TÁC</p>
            <h1 className="font-display mt-2 text-4xl font-semibold text-[#173b31]">Chào buổi sáng, Minh.</h1>
            <p className="mt-2 text-stone-500">Đây là tình hình chỗ nghỉ của bạn hôm nay.</p>
          </div>
          <button
            onClick={() => setSubmitted(true)}
            className="flex items-center justify-center gap-2 rounded-full bg-[#173b31] px-6 py-3.5 font-bold text-white transition hover:bg-[#245a4b]"
          >
            <span className="text-xl leading-none">+</span> Đăng chỗ nghỉ mới
          </button>
        </div>

        {submitted && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <Icon name="check" /> Hồ sơ mới đã được lưu và gửi cho quản trị viên xét duyệt.
          </div>
        )}

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="calendar" label="Đặt phòng tháng này" value="38" note="↑ 12% so với tháng trước" />
          <StatCard icon="wallet" label="Doanh thu dự kiến" value="86,4tr" note="↑ 8,5% so với tháng trước" />
          <StatCard icon="bed" label="Tỷ lệ lấp đầy" value="76%" note="Cao hơn 9% khu vực" />
          <StatCard icon="star" label="Điểm đánh giá" value="4,86" note="Từ 214 lượt đánh giá" />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold text-[#173b31]">Chỗ nghỉ của bạn</h2>
                <p className="mt-1 text-sm text-stone-500">Quản lý trạng thái và hiệu suất</p>
              </div>
              <button className="text-sm font-bold text-[#173b31]">Xem tất cả</button>
            </div>

            <div className="mt-6 flex flex-col gap-5 border-t border-stone-100 pt-6 sm:flex-row sm:items-center">
              <img src={photos.city} className="h-28 w-full rounded-xl object-cover sm:w-40" alt="Lumière Riverside Suites" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-stone-900">Lumière Riverside Suites</h3>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-extrabold text-emerald-700">
                    ĐANG HOẠT ĐỘNG
                  </span>
                </div>
                <p className="mt-2 text-sm text-stone-500">Thảo Điền, TP. Hồ Chí Minh · 12 phòng</p>
                <div className="mt-4 flex gap-6 text-sm">
                  <p><strong>18</strong><span className="text-stone-400"> đặt phòng</span></p>
                  <p><strong>72%</strong><span className="text-stone-400"> lấp đầy</span></p>
                </div>
              </div>
              <button className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold transition hover:bg-stone-50">
                Quản lý
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-5 border-t border-stone-100 pt-5 sm:flex-row sm:items-center">
              <img src={photos.anam} className="h-28 w-full rounded-xl object-cover sm:w-40" alt="An Nhiên Garden" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-stone-900">An Nhiên Garden</h3>
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-extrabold text-amber-700">
                    CHỜ DUYỆT
                  </span>
                </div>
                <p className="mt-2 text-sm text-stone-500">Hội An, Quảng Nam · 6 phòng</p>
                <p className="mt-4 text-sm text-stone-400">Đã gửi 18 thg 6 · Thường được duyệt trong 48h</p>
              </div>
              <button className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold transition hover:bg-stone-50">
                Xem hồ sơ
              </button>
            </div>
          </section>

          <aside className="rounded-2xl bg-[#173b31] p-7 text-white shadow-sm">
            <span className="grid size-11 place-items-center rounded-full bg-white/10 text-[#f2cc88]">
              <Icon name="sparkle" />
            </span>
            <h2 className="font-display mt-6 text-2xl font-semibold">Mẹo tăng hiển thị</h2>
            <p className="mt-3 text-sm leading-6 text-white/65">
              Hoàn thiện đủ 10 tiện nghi và thêm tối thiểu 8 ảnh chất lượng cao để xuất hiện nhiều hơn trong kết quả tìm kiếm.
            </p>
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[72%] rounded-full bg-[#d4a34f]" />
            </div>
            <div className="mt-3 flex justify-between text-xs font-bold">
              <span>Hồ sơ hoàn thiện</span>
              <span>72%</span>
            </div>
            <button className="mt-8 w-full rounded-full bg-white py-3 text-sm font-bold text-[#173b31] transition hover:bg-stone-100">
              Hoàn thiện hồ sơ
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}