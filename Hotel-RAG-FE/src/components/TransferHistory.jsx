// File: src/components/TransferHistory.jsx - lịch sử đặt xe đưa đón của khách (trang Hồ sơ)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import { TRANSFER_STATUS, formatPickup, formatVnd } from "../constants/transfer";

export default function TransferHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get("/transfers/my")
      .then((r) => setItems(r.data.data))
      .catch((e) => setError(e.response?.data?.message || "Không thể tải lịch sử đặt xe."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Xe đưa đón</h2>
          <p className="mt-2 text-sm text-slate-500">Các chuyến xe bạn đã đặt.</p>
        </div>
        <Link to="/transfers" className="rounded-xl bg-[#173b31] px-4 py-2 text-sm font-bold text-white hover:bg-[#245a4b]">Đặt xe mới</Link>
      </div>

      {loading ? (
        <p className="py-8 text-sm font-bold text-slate-500">Đang tải...</p>
      ) : error ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-sm text-slate-500">Bạn chưa đặt chuyến xe nào.</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((t) => {
            const status = TRANSFER_STATUS[t.status];
            return (
              <article key={t._id} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-400">#{t._id.slice(-6).toUpperCase()} · {t.companyId?.companyName}</p>
                    <h3 className="mt-1 font-bold text-[#173b31]">{t.routeId?.fromPlace} → {t.routeId?.toPlace}</h3>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                </div>
                <div className="mt-3 grid gap-1 text-sm text-slate-600">
                  <p>Giờ đón: <strong>{formatPickup(t.pickupTime)}</strong></p>
                  <p>{t.vehicleTypeId?.name} × {t.vehicles} · {t.passengers} khách{t.flightNumber ? ` · Chuyến bay ${t.flightNumber}` : ""}</p>
                  {t.companyId?.phone && <p>Nhà xe: <strong>{t.companyId.phone}</strong></p>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <p className="font-extrabold text-[#b7812d]">{formatVnd(t.totalAmount)}</p>
                  {t.paid && <span className="text-xs font-bold text-emerald-700">Đã thanh toán VNPay</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
