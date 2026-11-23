// File: src/components/CouponBox.jsx
// Ô nhập mã giảm giá ở trang thanh toán (đơn phòng: kind="hotel", đơn xe: kind="transfer").
// Áp / bỏ mã gọi API ngay để backend tính lại tổng tiền và giữ lượt dùng mã.
import { useEffect, useState } from "react";
import API from "../services/api";
import Icon from "./Icon";

const vnd = (n) => `${Number(n || 0).toLocaleString("vi-VN")}₫`;
const describe = (c) =>
  c.discountType === "percent"
    ? `Giảm ${c.value}%${c.maxDiscount ? ` (tối đa ${vnd(c.maxDiscount)})` : ""}`
    : `Giảm ${vnd(c.value)}`;

export default function CouponBox({ kind, orderId, hotelId, order, onChange, disabled }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone, text }
  const [suggestions, setSuggestions] = useState([]);
  const applied = order.coupon?.code ? order.coupon : null;

  useEffect(() => {
    API.get("/coupons/available", { params: { kind, hotelId } })
      .then((r) => setSuggestions(r.data.data))
      .catch(() => setSuggestions([]));
  }, [kind, hotelId]);

  const base = kind === "transfer" ? `/transfers/${orderId}/coupon` : `/bookings/${orderId}/coupon`;

  const apply = async (value) => {
    const c = (value ?? code).trim();
    if (!c) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await API.put(base, { code: c });
      onChange(res.data.data);
      setMessage({ tone: "success", text: res.data.message });
      setCode("");
    } catch (error) {
      setMessage({ tone: "error", text: error.response?.data?.message || "Không áp dụng được mã giảm giá." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await API.delete(base);
      onChange(res.data.data);
    } catch (error) {
      setMessage({ tone: "error", text: error.response?.data?.message || "Không bỏ được mã giảm giá." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 p-5">
      <p className="flex items-center gap-2 font-bold text-stone-800"><Icon name="wallet" size={18} /> Mã giảm giá</p>
      {applied ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm">
          <span className="font-semibold text-emerald-800">
            Đã áp dụng <b>{applied.code}</b> · giảm {vnd(applied.discountAmount)}
          </span>
          <button type="button" onClick={remove} disabled={busy || disabled} className="font-bold text-emerald-800 underline disabled:opacity-60">
            Bỏ mã
          </button>
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Nhập mã giảm giá</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Nhập mã, vd. GIAM10"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold uppercase outline-none focus:border-[#173b31]"
            />
          </label>
          <button
            type="submit"
            disabled={busy || disabled || !code.trim()}
            className="shrink-0 rounded-xl bg-[#173b31] px-5 py-3 text-sm font-bold text-white hover:bg-[#245a4b] disabled:opacity-50"
          >
            {busy ? "Đang áp..." : "Áp dụng"}
          </button>
        </form>
      )}
      {message && !(applied && message.tone === "success") && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-2 text-sm font-semibold ${message.tone === "error" ? "text-red-600" : "text-emerald-700"}`}>
          {message.text}
        </p>
      )}
      {!applied && suggestions.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-stone-500">Mã đang có:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((c) => (
              <button
                key={c.code}
                type="button"
                disabled={busy || disabled}
                onClick={() => apply(c.code)}
                title={c.description || describe(c)}
                className="rounded-lg border border-dashed border-[#b7812d] bg-amber-50 px-3 py-1.5 text-left text-xs text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              >
                <b>{c.code}</b> · {describe(c)}
                {c.minOrderAmount > 0 && <span className="text-amber-700"> · đơn từ {vnd(c.minOrderAmount)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
