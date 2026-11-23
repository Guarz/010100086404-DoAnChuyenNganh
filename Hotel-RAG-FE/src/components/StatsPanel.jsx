// File: src/components/StatsPanel.jsx
// Thống kê doanh thu và tỷ lệ lấp phòng theo tháng. scope="partner": khách sạn của Partner;
// scope="admin": toàn sàn (doanh thu phòng + xe) và có xuất báo cáo Excel / CSV.
import { useEffect, useState } from "react";
import API from "../services/api";
import BarChart from "./charts/BarChart";

// Màu đã kiểm tra bằng công cụ kiểm tra bảng màu (độ tương phản, người mù màu)
const ROOM_COLOR = "#2a78d6";
const TRANSFER_COLOR = "#eb6834";

const vnd = (n) => `${Math.round(n || 0).toLocaleString("vi-VN")}₫`;
const compactVnd = (n) => {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}k`;
  return String(n);
};
const pct = (n) => `${Number(n || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;

function Tile({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums text-[#173b31]">{value}</p>
      {note && <p className="mt-1 text-xs text-stone-500">{note}</p>}
    </div>
  );
}

function ExportBar() {
  // Mặc định 90 ngày gần nhất (theo giờ Việt Nam); tính một lần khi mở
  const vnDay = (offsetDays) => new Date(Date.now() + 7 * 3600000 - offsetDays * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(() => vnDay(89));
  const [to, setTo] = useState(() => vnDay(0));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const download = async (format, type) => {
    setBusy(`${format}-${type || ""}`);
    setError("");
    try {
      const res = await API.get("/admin/reports/export", { params: { format, type, from, to }, responseType: "blob" });
      const name = /filename="([^"]+)"/.exec(res.headers["content-disposition"] || "")?.[1] || `nestly-bao-cao.${format}`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      let message = "Không xuất được báo cáo.";
      try { message = JSON.parse(await err.response.data.text()).message || message; } catch { /* giữ thông báo chung */ }
      setError(message);
    } finally {
      setBusy("");
    }
  };

  const btn = "rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-[#173b31] hover:bg-stone-50 disabled:opacity-60";
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <p className="font-bold text-stone-800">Xuất báo cáo đơn đặt & doanh thu</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold text-stone-600">
          Từ ngày (ngày đặt)
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm" />
        </label>
        <label className="text-xs font-bold text-stone-600">
          Đến ngày
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm" />
        </label>
        <button type="button" disabled={Boolean(busy)} onClick={() => download("xlsx")} className="rounded-full bg-[#173b31] px-4 py-2 text-sm font-bold text-white hover:bg-[#245a4b] disabled:opacity-60">
          {busy === "xlsx-" ? "Đang tạo..." : "Excel (.xlsx)"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => download("csv", "hotel")} className={btn}>CSV đơn phòng</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => download("csv", "transfer")} className={btn}>CSV đơn xe</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => download("csv", "monthly")} className={btn}>CSV doanh thu tháng</button>
      </div>
      <p className="mt-2 text-xs text-stone-500">File Excel gồm 3 sheet: doanh thu theo tháng, đơn đặt phòng, đơn đặt xe. CSV mở được bằng Excel (UTF-8).</p>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

export default function StatsPanel({ scope = "partner" }) {
  const isAdmin = scope === "admin";
  const [months, setMonths] = useState(6);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    API.get(isAdmin ? "/admin/stats" : "/partner/stats", { params: { months } })
      .then((r) => { setData(r.data.data); setError(""); })
      .catch((e) => setError(e.response?.data?.message || "Không thể tải thống kê."));
  }, [isAdmin, months]);

  const series = isAdmin
    ? [{ key: "hotelRevenue", label: "Phòng", color: ROOM_COLOR }, { key: "transferRevenue", label: "Xe đưa đón", color: TRANSFER_COLOR }]
    : [{ key: "revenue", label: "Doanh thu", color: ROOM_COLOR }];

  return (
    <section className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#173b31]">{isAdmin ? "Thống kê toàn sàn" : "Doanh thu & tỷ lệ lấp phòng"}</h2>
          <p className="mt-1 text-sm text-stone-500">Doanh thu tính theo giao dịch thanh toán thành công; lấp phòng = đêm-phòng đã bán / đêm-phòng có thể bán.</p>
        </div>
        <label className="text-sm font-semibold text-stone-600">
          <span className="sr-only">Khoảng thời gian</span>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-bold">
            <option value={3}>3 tháng gần nhất</option>
            <option value={6}>6 tháng gần nhất</option>
            <option value={12}>12 tháng gần nhất</option>
          </select>
        </label>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      {!data && !error && <p className="mt-6 text-sm text-stone-500">Đang tải thống kê...</p>}

      {data && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Doanh thu" value={vnd(data.totals.revenue)} note={isAdmin ? `Phòng ${compactVnd(data.totals.hotelRevenue)} · Xe ${compactVnd(data.totals.transferRevenue)}` : `${months} tháng gần nhất`} />
            <Tile label="Đơn phòng đã thanh toán" value={data.totals.orders.toLocaleString("vi-VN")} />
            <Tile label="Tỷ lệ lấp phòng" value={pct(data.totals.occupancyRate)} note={`Trên ${data.totals.rooms} phòng đang mở bán`} />
            <Tile label="Đêm-phòng đã bán" value={data.months.reduce((s, m) => s + m.soldRoomNights, 0).toLocaleString("vi-VN")} />
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <BarChart
              title={isAdmin ? "Doanh thu theo tháng (phòng + xe)" : "Doanh thu theo tháng"}
              data={data.months.map((m) => ({ label: m.label, values: isAdmin ? { hotelRevenue: m.hotelRevenue, transferRevenue: m.transferRevenue } : { revenue: m.revenue } }))}
              series={series}
              formatValue={vnd}
              formatAxis={compactVnd}
            />
            <BarChart
              title="Tỷ lệ lấp phòng theo tháng"
              data={data.months.map((m) => ({ label: m.label, values: { occupancyRate: m.occupancyRate } }))}
              series={[{ key: "occupancyRate", label: "Lấp phòng", color: ROOM_COLOR }]}
              formatValue={pct}
              formatAxis={(v) => `${v}%`}
              yMax={Math.max(10, ...data.months.map((m) => m.occupancyRate))}
            />
          </div>

          {data.byHotel.length > 0 && (
            <div className="mt-8 overflow-x-auto">
              <p className="text-sm font-bold text-stone-800">Lấp phòng theo khách sạn ({months} tháng)</p>
              <table className="mt-2 w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs uppercase text-stone-500">
                  <tr>
                    <th className="py-2 pr-4 font-bold">Khách sạn</th>
                    <th className="py-2 pr-4 text-right font-bold">Số phòng</th>
                    <th className="py-2 pr-4 text-right font-bold">Đêm-phòng đã bán</th>
                    <th className="py-2 font-bold">Tỷ lệ lấp phòng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 tabular-nums">
                  {data.byHotel.slice(0, 20).map((h) => (
                    <tr key={h.hotelId}>
                      <td className="py-2 pr-4 text-stone-800">{h.hotelName}</td>
                      <td className="py-2 pr-4 text-right text-stone-700">{h.rooms}</td>
                      <td className="py-2 pr-4 text-right text-stone-700">{h.soldRoomNights.toLocaleString("vi-VN")}</td>
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-28 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
                            <span className="block h-full rounded-full" style={{ width: `${Math.min(100, h.occupancyRate)}%`, background: ROOM_COLOR }} />
                          </span>
                          <span className="text-stone-800">{pct(h.occupancyRate)}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isAdmin && <div className="mt-8"><ExportBar /></div>}
        </>
      )}
    </section>
  );
}
