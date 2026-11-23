// File: src/components/charts/BarChart.jsx
// Biểu đồ cột (SVG tự vẽ, không thư viện). Theo quy chuẩn trực quan hóa dữ liệu:
//  - một trục Y duy nhất; cột <= 24px, bo 4px ở đầu cột, vuông ở đáy; khe 2px giữa các phần cột chồng
//  - lưới mảnh, nhạt; chỉ ghi số ở cột cao nhất; tooltip khi rê chuột / focus bằng bàn phím
//  - >= 2 nhóm dữ liệu thì luôn có chú thích; luôn có "Xem dạng bảng" cho trình đọc màn hình
import { useMemo, useState } from "react";

const W = 640;
const PAD = { top: 24, right: 12, bottom: 34, left: 56 };
const BAR_MAX = 24;
const GAP = 2;

// Bước chia trục Y "đẹp": 1, 2, 2.5, 5 x 10^n
function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

// Hình cột: bo tròn 2 góc trên (đầu cột), vuông ở đáy
function barPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  if (h <= 0) return "";
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export default function BarChart({ title, data, series, formatValue = String, formatAxis = formatValue, height = 260, yMax }) {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const totals = data.map((d) => series.reduce((s, se) => s + (d.values[se.key] || 0), 0));
  const ticks = useMemo(() => niceTicks(yMax ?? Math.max(...totals, 0)), [totals, yMax]);
  const top = ticks[ticks.length - 1] || 1;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(BAR_MAX, band * 0.5);
  const y = (v) => PAD.top + innerH - (v / top) * innerH;
  const maxIndex = totals.indexOf(Math.max(...totals));

  return (
    <figure className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="text-sm font-bold text-stone-800">{title}</figcaption>
        <div className="flex flex-wrap items-center gap-3">
          {series.length > 1 && (
            <ul className="flex flex-wrap gap-3 text-xs text-stone-600" aria-label="Chú thích">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            aria-pressed={showTable}
            className="rounded-full border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-50"
          >
            {showTable ? "Xem biểu đồ" : "Xem dạng bảng"}
          </button>
        </div>
      </div>

      {showTable ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-stone-500">
              <tr>
                <th className="py-2 pr-4 font-bold">Tháng</th>
                {series.map((s) => <th key={s.key} className="py-2 pr-4 text-right font-bold">{s.label}</th>)}
                {series.length > 1 && <th className="py-2 text-right font-bold">Tổng</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 tabular-nums">
              {data.map((d, i) => (
                <tr key={d.label}>
                  <td className="py-2 pr-4 text-stone-700">{d.label}</td>
                  {series.map((s) => <td key={s.key} className="py-2 pr-4 text-right text-stone-800">{formatValue(d.values[s.key] || 0)}</td>)}
                  {series.length > 1 && <td className="py-2 text-right font-semibold text-stone-900">{formatValue(totals[i])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${title}. Dùng nút "Xem dạng bảng" để đọc số liệu.`}>
            {/* Lưới + nhãn trục Y */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e7e5e0" strokeWidth="1" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-stone-500 text-[11px] tabular-nums">{formatAxis(t)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = PAD.left + band * i + band / 2;
              const x = cx - barW / 2;
              let acc = 0;
              const parts = series
                .map((s) => ({ s, v: d.values[s.key] || 0 }))
                .filter((p) => p.v > 0);
              return (
                <g key={d.label}>
                  {/* Vùng nhận chuột rộng hơn cột */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={innerH}
                    fill={hover === i ? "#f5f4f0" : "transparent"}
                    tabIndex={0}
                    role="button"
                    aria-label={`${d.label}: ${series.map((s) => `${s.label} ${formatValue(d.values[s.key] || 0)}`).join(", ")}`}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="cursor-default outline-none"
                  />
                  {parts.map((p, k) => {
                    const h = (p.v / top) * innerH;
                    const yTop = y(acc + p.v);
                    // Khe 2px màu nền giữa các phần chồng nhau
                    const gap = k > 0 ? GAP : 0;
                    acc += p.v;
                    const isTop = k === parts.length - 1;
                    return isTop ? (
                      <path key={p.s.key} d={barPath(x, yTop, barW, Math.max(0, h - gap), 4)} fill={p.s.color} pointerEvents="none" />
                    ) : (
                      <rect key={p.s.key} x={x} y={yTop} width={barW} height={Math.max(0, h - gap)} fill={p.s.color} pointerEvents="none" />
                    );
                  })}
                  {/* Chỉ ghi số ở cột cao nhất */}
                  {i === maxIndex && totals[i] > 0 && (
                    <text x={cx} y={y(totals[i]) - 6} textAnchor="middle" className="fill-stone-800 text-[11px] font-semibold tabular-nums" pointerEvents="none">
                      {formatAxis(totals[i])}
                    </text>
                  )}
                  <text x={cx} y={H - PAD.bottom + 18} textAnchor="middle" className="fill-stone-500 text-[11px]" pointerEvents="none">{d.label}</text>
                </g>
              );
            })}
            <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#d6d3cc" strokeWidth="1" />
          </svg>
          {hover !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-1 z-10 min-w-52 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={{ left: `${Math.min(70, Math.max(2, ((PAD.left + band * hover + band / 2) / W) * 100 - 10))}%` }}
            >
              <p className="font-bold text-stone-900">{data[hover].label}</p>
              {series.map((s) => (
                <p key={s.key} className="mt-1 flex items-center justify-between gap-4 text-stone-700">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                    {s.label}
                  </span>
                  <span className="whitespace-nowrap font-semibold tabular-nums text-stone-900">{formatValue(data[hover].values[s.key] || 0)}</span>
                </p>
              ))}
              {series.length > 1 && (
                <p className="mt-1 flex justify-between gap-4 border-t border-stone-100 pt-1 font-semibold text-stone-900">
                  <span>Tổng</span><span className="tabular-nums">{formatValue(totals[hover])}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
