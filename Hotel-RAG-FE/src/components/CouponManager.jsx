// File: src/components/CouponManager.jsx
// Quản lý mã giảm giá. Admin: mã toàn sàn (phòng / xe / cả hai). Partner: mã cho một khách sạn của mình.
import { useEffect, useState } from "react";
import API from "../services/api";

const vnd = (n) => `${Number(n || 0).toLocaleString("vi-VN")}₫`;
const SCOPE = { hotel: "Đặt phòng", transfer: "Xe đưa đón", all: "Phòng + xe" };
const EMPTY = {
  code: "", description: "", discountType: "percent", value: "", maxDiscount: "", minOrderAmount: "",
  appliesTo: "hotel", hotelId: "", expiresAt: "", usageLimit: "", perUserLimit: "1",
};
const inputClass = "mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#173b31]";

export default function CouponManager({ role, hotels = [] }) {
  const isAdmin = role === "Admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = () =>
    API.get("/coupons")
      .then((r) => { setItems(r.data.data); setError(""); })
      .catch((e) => setError(e.response?.data?.message || "Không thể tải mã giảm giá."))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { ...form, code: form.code.trim().toUpperCase() };
      if (body.discountType !== "percent") delete body.maxDiscount;
      if (!isAdmin) delete body.appliesTo;
      const res = await API.post("/coupons", body);
      setNotice(res.data.message);
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Không tạo được mã giảm giá.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    setBusyId(c._id);
    try {
      await API.put(`/coupons/${c._id}`, { isActive: !c.isActive });
      setItems((list) => list.map((x) => (x._id === c._id ? { ...x, isActive: !c.isActive } : x)));
    } catch (err) {
      setError(err.response?.data?.message || "Không cập nhật được mã.");
    } finally {
      setBusyId("");
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Xóa mã ${c.code}?`)) return;
    setBusyId(c._id);
    try {
      await API.delete(`/coupons/${c._id}`);
      setItems((list) => list.filter((x) => x._id !== c._id));
    } catch (err) {
      setError(err.response?.data?.message || "Không xóa được mã.");
    } finally {
      setBusyId("");
    }
  };

  const expired = (c) => c.expiresAt && new Date(c.expiresAt) < new Date();

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-100 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#173b31]">Mã giảm giá</h2>
          <p className="mt-1 text-sm text-stone-500">
            {isAdmin ? "Mã toàn sàn cho đặt phòng và / hoặc xe đưa đón." : "Mã chỉ áp dụng cho đặt phòng tại khách sạn bạn chọn."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          aria-expanded={showForm}
          className="rounded-full bg-[#173b31] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#245a4b]"
        >
          {showForm ? "Đóng" : "+ Tạo mã mới"}
        </button>
      </div>

      {notice && (
        <p role="status" className="mx-5 mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>
      )}
      {error && <p role="alert" className="mx-5 mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {showForm && (
        <form onSubmit={create} className="grid gap-4 border-b border-stone-100 bg-stone-50 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <label className="text-sm font-bold text-stone-700">
            Mã <span className="text-red-600">*</span>
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} pattern="[A-Za-z0-9_\-]{3,30}" placeholder="VD: HE2026" className={`${inputClass} uppercase`} />
          </label>
          <label className="text-sm font-bold text-stone-700">
            Kiểu giảm
            <select value={form.discountType} onChange={set("discountType")} className={inputClass}>
              <option value="percent">Theo %</option>
              <option value="amount">Số tiền cố định</option>
            </select>
          </label>
          <label className="text-sm font-bold text-stone-700">
            {form.discountType === "percent" ? "Giảm (%)" : "Giảm (₫)"} <span className="text-red-600">*</span>
            <input required type="number" min={form.discountType === "percent" ? 1 : 1000} max={form.discountType === "percent" ? 100 : undefined} value={form.value} onChange={set("value")} className={inputClass} />
          </label>
          {form.discountType === "percent" ? (
            <label className="text-sm font-bold text-stone-700">
              Giảm tối đa (₫)
              <input type="number" min="0" value={form.maxDiscount} onChange={set("maxDiscount")} placeholder="Không giới hạn" className={inputClass} />
            </label>
          ) : <div className="hidden lg:block" />}
          {isAdmin ? (
            <label className="text-sm font-bold text-stone-700">
              Áp dụng cho
              <select value={form.appliesTo} onChange={set("appliesTo")} className={inputClass}>
                <option value="hotel">Đặt phòng</option>
                <option value="transfer">Xe đưa đón</option>
                <option value="all">Cả phòng và xe</option>
              </select>
            </label>
          ) : (
            <label className="text-sm font-bold text-stone-700">
              Khách sạn <span className="text-red-600">*</span>
              <select required value={form.hotelId} onChange={set("hotelId")} className={inputClass}>
                <option value="">Chọn khách sạn</option>
                {hotels.filter((h) => h.status === "Approved").map((h) => (
                  <option key={h._id} value={h._id}>{h.hotelName}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm font-bold text-stone-700">
            Đơn tối thiểu (₫)
            <input type="number" min="0" value={form.minOrderAmount} onChange={set("minOrderAmount")} placeholder="0" className={inputClass} />
          </label>
          <label className="text-sm font-bold text-stone-700">
            Hết hạn
            <input type="date" value={form.expiresAt} onChange={set("expiresAt")} className={inputClass} />
          </label>
          <label className="text-sm font-bold text-stone-700">
            Tổng lượt dùng
            <input type="number" min="1" value={form.usageLimit} onChange={set("usageLimit")} placeholder="Không giới hạn" className={inputClass} />
          </label>
          <label className="text-sm font-bold text-stone-700 sm:col-span-2 lg:col-span-3">
            Mô tả
            <input value={form.description} onChange={set("description")} maxLength={200} placeholder="VD: Ưu đãi mùa hè cho khách mới" className={inputClass} />
          </label>
          <label className="text-sm font-bold text-stone-700">
            Lượt / khách
            <input type="number" min="1" value={form.perUserLimit} onChange={set("perUserLimit")} className={inputClass} />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={saving} className="rounded-xl bg-[#b7812d] px-6 py-3 text-sm font-bold text-white hover:bg-[#9e6e24] disabled:opacity-60">
              {saving ? "Đang tạo..." : "Tạo mã"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="p-10 text-center text-sm text-stone-500">Đang tải...</p>
      ) : items.length === 0 ? (
        <p className="p-10 text-center text-sm text-stone-500">Chưa có mã giảm giá nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-3 font-bold">Mã</th>
                <th className="px-5 py-3 font-bold">Ưu đãi</th>
                <th className="px-5 py-3 font-bold">Phạm vi</th>
                <th className="px-5 py-3 font-bold">Đã dùng</th>
                <th className="px-5 py-3 font-bold">Hết hạn</th>
                <th className="px-5 py-3 font-bold">Trạng thái</th>
                <th className="px-5 py-3 text-right font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((c) => (
                <tr key={c._id}>
                  <td className="px-5 py-3">
                    <p className="font-mono font-bold text-[#173b31]">{c.code}</p>
                    {c.description && <p className="mt-0.5 text-xs text-stone-500">{c.description}</p>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-stone-700">
                    {c.discountType === "percent" ? `${c.value}%` : vnd(c.value)}
                    {c.maxDiscount ? <span className="block text-xs text-stone-500">tối đa {vnd(c.maxDiscount)}</span> : null}
                    {c.minOrderAmount ? <span className="block text-xs text-stone-500">đơn từ {vnd(c.minOrderAmount)}</span> : null}
                  </td>
                  <td className="px-5 py-3 text-stone-700">{c.hotelId?.hotelName || SCOPE[c.appliesTo]}</td>
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-stone-700">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-stone-700">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("vi-VN") : "Không"}</td>
                  <td className="px-5 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${
                      expired(c) ? "bg-stone-100 text-stone-600" : c.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {expired(c) ? "Hết hạn" : c.isActive ? "Đang áp dụng" : "Đã tắt"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <button type="button" onClick={() => toggle(c)} disabled={busyId === c._id} className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                      {c.isActive ? "Tắt" : "Bật"}
                    </button>
                    {c.usedCount === 0 && (
                      <button type="button" onClick={() => remove(c)} disabled={busyId === c._id} className="ml-2 rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                        Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
