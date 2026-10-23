// File: src/pages/Home.jsx
// import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";

const photos = {
  hero: "https://images.unsplash.com/photo-1615722440048-da4ccf6de048?auto=format&fit=crop&w=1800&q=88",
};

export default function Home() {
  const navigate = useNavigate();

  return (
    <main>
      <section className="relative mx-auto mt-4 min-h-[680px] max-w-[1500px] overflow-hidden rounded-[2rem] bg-[#173b31] sm:mx-4 lg:mx-auto">
        <img src={photos.hero} alt="Khu nghỉ dưỡng" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102f28]/90 via-[#102f28]/55 to-transparent" />
        
        <div className="relative mx-auto flex min-h-[680px] max-w-7xl flex-col justify-center px-6 pb-32 pt-20 lg:px-8">
          <div className="mb-6 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md">
            <Icon name="sparkle" size={16} /> Hơn 12.000 chỗ nghỉ đã được tuyển chọn
          </div>
          <h1 className="font-display max-w-3xl text-5xl leading-[1.05] font-medium tracking-tight text-white sm:text-7xl">
            Đi đâu cũng được.<br /><span className="italic text-[#f2cc88]">Miễn là thật đáng nhớ.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-white/80">
            Từ homestay ấm cúng đến những khu nghỉ dưỡng bên biển — tìm một nơi dành riêng cho chuyến đi của bạn.
          </p>
        </div>

        {/* THANH TÌM KIẾM THỦ CÔNG (GỐC) */}
        <div className="absolute inset-x-4 bottom-5 mx-auto max-w-6xl rounded-2xl bg-white p-3 shadow-2xl sm:inset-x-8 lg:flex lg:items-center">
          <label className="flex flex-1 items-center gap-4 rounded-xl px-4 py-3 hover:bg-stone-50">
            <span className="text-[#b7812d]"><Icon name="location" size={22} /></span>
            <span className="flex-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-stone-400">Điểm đến</span>
              <input className="mt-1 w-full bg-transparent font-semibold text-stone-800 outline-none" defaultValue="Đà Nẵng" aria-label="Điểm đến" />
            </span>
          </label>
          <div className="hidden h-10 w-px bg-stone-200 lg:block" />
          <button className="flex flex-1 items-center gap-4 rounded-xl px-4 py-3 text-left hover:bg-stone-50">
            <span className="text-[#b7812d]"><Icon name="calendar" size={22} /></span>
            <span><span className="block text-xs font-bold uppercase tracking-wider text-stone-400">Nhận phòng — Trả phòng</span><span className="mt-1 block font-semibold">21 thg 6 — 24 thg 6</span></span>
          </button>
          <div className="hidden h-10 w-px bg-stone-200 lg:block" />
          <button className="flex flex-1 items-center gap-4 rounded-xl px-4 py-3 text-left hover:bg-stone-50">
            <span className="text-[#b7812d]"><Icon name="users" size={22} /></span>
            <span><span className="block text-xs font-bold uppercase tracking-wider text-stone-400">Khách & phòng</span><span className="mt-1 block font-semibold">2 khách, 1 phòng</span></span>
          </button>
          <button onClick={() => navigate("/hotels")} className="flex items-center justify-center gap-2 rounded-xl bg-[#d09b42] px-7 py-5 font-bold text-white transition hover:bg-[#b7812d]">
            <Icon name="search" size={19} /> Tìm kiếm
          </button>
        </div>
      </section>

      {/* Phần Partner (Giữ nguyên) */}
      <section className="bg-[#f1eee6] py-24 mt-12">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 lg:grid-cols-2 lg:px-8">
          <div>
            <span className="grid size-12 place-items-center rounded-full bg-[#e2b765] text-white"><Icon name="home" size={23} /></span>
            <h2 className="font-display mt-7 text-4xl font-semibold leading-tight text-[#173b31] sm:text-5xl">Biến chỗ trống thành<br /><span className="italic">nguồn thu mới.</span></h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-stone-600">Đăng khách sạn, villa hoặc homestay của bạn. Nestly đồng hành từ bước thiết lập đầu tiên đến khi đón những vị khách đầu tiên.</p>
            <button onClick={() => navigate("/partner-apply")} className="mt-8 flex items-center gap-2 rounded-full bg-[#173b31] px-6 py-3.5 font-bold text-white transition hover:bg-[#245a4b]">Làm shop <Icon name="arrow" size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm"><p className="font-display text-4xl font-semibold text-[#173b31]">18%</p><p className="mt-2 text-sm leading-6 text-stone-500">Thu nhập trung bình tăng sau 3 tháng</p></div>
            <div className="mt-8 rounded-2xl bg-[#173b31] p-6 text-white"><Icon name="shield" /><p className="mt-8 font-semibold">Thanh toán an toàn</p><p className="mt-2 text-sm text-white/60">Được bảo vệ trên mọi giao dịch</p></div>
            <div className="-mt-4 rounded-2xl bg-[#d4a34f] p-6 text-white"><Icon name="users" /><p className="mt-8 font-semibold">12.000+ đối tác</p></div>
            <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm"><p className="font-display text-4xl font-semibold text-[#173b31]">24/7</p><p className="mt-2 text-sm text-stone-500">Đội ngũ hỗ trợ riêng</p></div>
          </div>
        </div>
      </section>
    </main>
  );
}