// File: src/components/admin/TransportCompaniesPanel.jsx - Admin duyệt / từ chối hồ sơ nhà xe
import { useEffect, useState } from "react";
import API from "../../services/api";

const STATUS = {
  Pending: { label: "Chờ duyệt", className: "bg-amber-100 text-amber-800" },
  Approved: { label: "Đã duyệt", className: "bg-emerald-100 text-emerald-800" },
  Rejected: { label: "Từ chối", className: "bg-red-100 text-red-700" },
};

// onSummary: báo số hồ sơ theo trạng thái lên trang Admin (hiện số chờ duyệt trên tab)
export default function TransportCompaniesPanel({ onSummary }) {
  const [filter, setFilter] = useState("Pending");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ Pending: 0, Approved: 0, Rejected: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = (status = filter) =>
    API.get("/admin/transport-companies", { params: { status } })
      .then((r) => {
        setItems(r.data.data);
        setSummary(r.data.summary);
        onSummary?.(r.data.summary);
        setError("");
      })
      .catch((e) => setError(e.response?.data?.message || "Không thể tải danh sách nhà xe."))
      .finally(() => setLoading(false));

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const changeFilter = (s) => {
    if (s === filter) return;
    setLoading(true);
    setFilter(s);
  };

  const decide = async (company, status) => {
    let reason;
    if (status === "Rejected") {
      reason = window.prompt(`Lý do từ chối nhà xe "${company.companyName}" (không bắt buộc):`, "");
      if (reason === null) return;
    }
    setBusyId(company._id);
    try {
      await API.put(`/admin/transport-companies/${company._id}/status`, { status, reason });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Không thể cập nhật hồ sơ.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-4 sm:p-5">
        {["Pending", "Approved", "Rejected", "all"].map((s) => (
          <button
            key={s}
            onClick={() => changeFilter(s)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${filter === s ? "bg-[#173b31] text-white" : "bg-stone-100 text-stone-600"}`}
          >
            {s === "all" ? "Tất cả" : STATUS[s].label} ({summary[s] ?? 0})
          </button>
        ))}
      </div>

      {error && <p role="alert" className="m-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
      {loading ? (
        <p className="p-8 text-center text-stone-500">Đang tải...</p>
      ) : items.length === 0 ? (
        <p className="p-8 text-center text-stone-500">Không có hồ sơ nhà xe nào.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {items.map((c) => (
            <li key={c._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[#173b31]">{c.companyName}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span>
                </div>
                <p className="mt-1 text-sm text-stone-600">
                  GP {c.licenseNumber} · {c.phone} · {c.serviceProvinces.join(", ")}
                </p>
                <p className="mt-0.5 text-xs text-stone-400">
                  Chủ: {c.ownerId?.fullName} ({c.ownerId?.email}) · gửi {new Date(c.createdAt).toLocaleDateString("vi-VN")}
                </p>
                {c.description && <p className="mt-1 text-sm text-stone-500">{c.description}</p>}
                {c.rejectionReason && <p className="mt-1 text-xs font-semibold text-red-600">Lý do từ chối: {c.rejectionReason}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                {c.status !== "Approved" && (
                  <button disabled={busyId === c._id} onClick={() => decide(c, "Approved")} className="rounded-xl bg-[#173b31] px-4 py-2 text-sm font-bold text-white hover:bg-[#245a4b] disabled:opacity-60">
                    Duyệt
                  </button>
                )}
                {c.status !== "Rejected" && (
                  <button disabled={busyId === c._id} onClick={() => decide(c, "Rejected")} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60">
                    {c.status === "Approved" ? "Gỡ duyệt" : "Từ chối"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
