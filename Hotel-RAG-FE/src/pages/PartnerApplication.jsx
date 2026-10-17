// File: src/pages/PartnerApplication.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon"; // Hoặc "../components/Icon"

export default function PartnerApplication() {
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#f1eee6] py-14">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl lg:grid-cols-[0.8fr_1.2fr]">
        {/* Cột giới thiệu bên trái */}
        <div className="bg-[#173b31] p-9 text-white lg:p-12">
          <span className="grid size-12 place-items-center rounded-full bg-white/10 text-[#f2cc88]">
            <Icon name="home" />
          </span>
          <h1 className="font-display mt-8 text-4xl leading-tight">Trở thành đối tác của Nestly</h1>
          <p className="mt-5 leading-7 text-white/65">
            Tiếp cận hàng triệu khách du lịch và quản lý chỗ nghỉ của bạn trên một nền tảng duy nhất.
          </p>
          <div className="mt-10 space-y-5">
            {["Thiết lập miễn phí", "Chủ động giá và lịch phòng", "Hỗ trợ đối tác 24/7"].map((item) => (
              <p key={item} className="flex items-center gap-3 text-sm font-semibold">
                <span className="grid size-6 place-items-center rounded-full bg-white/10">
                  <Icon name="check" size={14} />
                </span>
                {item}
              </p>
            ))}
          </div>
        </div>

        {/* Cột Form đăng ký bên phải */}
        <div className="p-8 lg:p-12">
          {sent ? (
            <div className="flex h-full min-h-96 flex-col items-center justify-center text-center">
              <span className="grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <Icon name="check" size={28} />
              </span>
              <h2 className="font-display mt-6 text-3xl text-[#173b31]">Đã gửi đơn đăng ký</h2>
              <p className="mt-3 max-w-md text-stone-500">
                Admin sẽ xác minh thông tin và phản hồi trong vòng 1–2 ngày làm việc.
              </p>
              <button
                onClick={() => navigate("/")}
                className="mt-7 rounded-full bg-[#173b31] px-6 py-3 font-bold text-white transition hover:bg-[#245a4b]"
              >
                Về trang chủ
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold uppercase tracking-widest text-[#b7812d]">Đăng ký đối tác</p>
              <h2 className="font-display mt-2 text-3xl text-[#173b31]">Thông tin của bạn</h2>
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Họ và tên
                  <input
                    className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-[#b7812d]"
                    defaultValue="Nguyễn Minh An"
                  />
                </label>
                <label className="text-sm font-bold">
                  Số điện thoại
                  <input
                    className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-[#b7812d]"
                    placeholder="09xx xxx xxx"
                  />
                </label>
                <label className="text-sm font-bold sm:col-span-2">
                  Email
                  <input
                    className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-[#b7812d]"
                    defaultValue="an.nguyen@email.com"
                  />
                </label>
                <label className="text-sm font-bold">
                  Loại hình sở hữu
                  <select className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 font-normal">
                    <option>Cá nhân</option>
                    <option>Doanh nghiệp</option>
                  </select>
                </label>
                <label className="text-sm font-bold">
                  Khu vực chỗ nghỉ
                  <select className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 font-normal">
                    <option>Đà Nẵng</option>
                    <option>Hội An</option>
                    <option>Khánh Hòa</option>
                  </select>
                </label>
                <label className="text-sm font-bold sm:col-span-2">
                  Tên chỗ nghỉ dự kiến
                  <input
                    className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-[#b7812d]"
                    placeholder="Ví dụ: An Nhiên Garden"
                  />
                </label>
              </div>
              <label className="mt-5 flex items-start gap-3 text-sm text-stone-500">
                <input type="checkbox" className="mt-1 accent-[#173b31]" />
                Tôi xác nhận thông tin trên là chính xác và đồng ý với điều khoản dành cho đối tác.
              </label>
              <button
                onClick={() => setSent(true)}
                className="mt-7 w-full rounded-xl bg-[#173b31] py-3.5 font-bold text-white transition hover:bg-[#245a4b]"
              >
                Gửi đơn để xét duyệt
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}