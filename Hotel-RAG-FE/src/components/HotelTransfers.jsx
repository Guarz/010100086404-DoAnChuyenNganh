// File: src/components/HotelTransfers.jsx - gợi ý xe đưa đón ở thành phố của khách sạn (trang chi tiết KS)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import Icon from "./Icon";
import { formatVnd } from "../constants/transfer";

export default function HotelTransfers({ hotelId, date }) {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    API.get("/transfers/search", { params: { hotelId, date } })
      .then((r) => setOptions(r.data.data))
      .catch(() => setOptions([]));
  }, [hotelId, date]);

  if (!options.length) return null; // thành phố chưa có nhà xe -> ẩn hẳn mục này

  return (
    <section className="mt-10 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#173b31]"><Icon name="car" size={22} /> Xe đưa đón tại {options[0].province}</h2>
          <p className="mt-1 text-sm text-stone-500">Đặt xe riêng từ sân bay / nhà ga về khách sạn.</p>
        </div>
        <Link to={`/transfers?hotelId=${hotelId}${date ? `&date=${date}` : ""}`} className="text-sm font-bold text-[#b7812d] hover:underline">
          Xem tất cả {options.length} lựa chọn →
        </Link>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {options.slice(0, 3).map((o) => (
          <Link
            key={o.routeId}
            to={`/transfers?hotelId=${hotelId}${date ? `&date=${date}` : ""}`}
            className="rounded-2xl border border-stone-200 p-4 transition hover:border-[#173b31] hover:shadow-md"
          >
            <p className="text-xs font-bold text-stone-400">{o.company.companyName}</p>
            <p className="mt-1 font-bold text-stone-800">{o.fromPlace} → {o.toPlace}</p>
            <p className="mt-1 text-sm text-stone-500">{o.vehicle.name} · {o.vehicle.seats} chỗ</p>
            <p className="mt-2 font-extrabold text-[#b7812d]">từ {formatVnd(o.price)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
