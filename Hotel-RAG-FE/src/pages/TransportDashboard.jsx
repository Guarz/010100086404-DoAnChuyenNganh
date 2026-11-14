// File: src/pages/TransportDashboard.jsx - Trung tâm nhà xe: loại xe, tuyến, lịch xe trống, đơn đặt xe
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import Icon from "../components/Icon";
import StatCard from "../components/StatCard";
import { InventoryModal, RouteModal, VehicleModal } from "../components/transport/TransportModals";
import { TRANSFER_STATUS, formatPickup, formatVnd, formatVndShort, vnDateKey } from "../constants/transfer";

const tabClass = (active) =>
  `shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold transition sm:px-5 ${active ? "bg-white text-[#173b31] shadow-sm" : "text-stone-500"}`;

function VehiclesPanel({ company, vehicles, reload, notify }) {
  const [modal, setModal] = useState(null); // { type: 'vehicle'|'route'|'inventory', vehicle, route }
  const close = () => setModal(null);
  const saved = (msg, shouldClose = true) => {
    notify(msg);
    reload();
    if (shouldClose) close();
  };

  const toggle = async (url, isActive) => {
    try {
      const r = await API.put(url, { isActive });
      notify(r.data.message);
      reload();
    } catch (e) {
      notify(e.response?.data?.message || "Không thể cập nhật.");
    }
  };

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">Mỗi loại xe có lịch số xe trống theo ngày và một hoặc nhiều tuyến đưa đón.</p>
        <button onClick={() => setModal({ type: "vehicle" })} className="rounded-xl bg-[#173b31] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#245a4b]">
          + Thêm loại xe
        </button>
      </div>

      {vehicles.length === 0 && (
        <div className="mt-5 rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
          Chưa có loại xe nào. Thêm loại xe đầu tiên để khách có thể đặt.
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {vehicles.map((v) => (
          <article key={v._id} className={`rounded-3xl border bg-white p-5 shadow-sm ${v.isActive ? "border-stone-200" : "border-dashed border-stone-300 opacity-70"}`}>
            <div className="flex items-start gap-4">
              <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#f1eee6] text-[#b7812d]">
                {v.images?.[0] ? <img src={v.images[0]} alt="" className="size-full object-cover" /> : <Icon name="car" size={26} />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-[#173b31]">{v.name} {!v.isActive && <span className="ml-1 text-xs font-semibold text-stone-500">(đang ẩn)</span>}</h3>
                <p className="text-sm text-stone-500">{v.seats} chỗ · {v.luggage} vali · {v.totalVehicles} xe</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
              <button onClick={() => setModal({ type: "vehicle", vehicle: v })} className="rounded-lg bg-stone-100 px-3 py-2 hover:bg-stone-200">Sửa</button>
              <button onClick={() => setModal({ type: "inventory", vehicle: v })} className="rounded-lg bg-stone-100 px-3 py-2 hover:bg-stone-200">Lịch xe trống</button>
              <button onClick={() => setModal({ type: "route", vehicle: v })} className="rounded-lg bg-stone-100 px-3 py-2 hover:bg-stone-200">+ Tuyến</button>
              <button onClick={() => toggle(`/transport/vehicles/${v._id}`, !v.isActive)} className="rounded-lg bg-stone-100 px-3 py-2 hover:bg-stone-200">
                {v.isActive ? "Ẩn xe" : "Hiện xe"}
              </button>
            </div>
            <ul className="mt-4 divide-y divide-stone-100 border-t border-stone-100">
              {v.routes.length === 0 && <li className="py-3 text-sm text-stone-400">Chưa có tuyến — khách chưa thấy xe này.</li>}
              {v.routes.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div className={`min-w-0 ${r.isActive ? "" : "text-stone-400 line-through"}`}>
                    <p className="font-semibold">{r.fromPlace} → {r.toPlace}</p>
                    <p className="text-xs text-stone-500">{r.province} · ~{r.durationMin} phút · {formatVnd(r.price)}</p>
                  </div>
                  <div className="flex gap-2 text-xs font-bold">
                    <button onClick={() => setModal({ type: "route", vehicle: v, route: r })} className="rounded-lg px-2 py-1 text-[#173b31] hover:bg-stone-100">Sửa</button>
                    <button onClick={() => toggle(`/transport/routes/${r._id}`, !r.isActive)} className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100">
                      {r.isActive ? "Tạm ngưng" : "Mở lại"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {modal?.type === "vehicle" && <VehicleModal vehicle={modal.vehicle} onClose={close} onSaved={saved} />}
      {modal?.type === "route" && (
        <RouteModal vehicle={modal.vehicle} route={modal.route} provinces={company.serviceProvinces} onClose={close} onSaved={saved} />
      )}
      {modal?.type === "inventory" && <InventoryModal vehicle={modal.vehicle} onClose={close} onSaved={saved} />}
    </section>
  );
}

function BookingsPanel({ bookings, reload, notify }) {
  const [filter, setFilter] = useState("upcoming");
  const today = vnDateKey(0);
  const shown = bookings.filter((b) => {
    if (filter === "upcoming") return b.status === "Confirmed";
    if (filter === "done") return b.status === "Completed";
    return b.status === "Canceled";
  });

  const complete = async (b) => {
    try {
      const r = await API.put(`/transport/bookings/${b._id}/complete`);
      notify(r.data.message);
      reload();
    } catch (e) {
      notify(e.response?.data?.message || "Không thể cập nhật đơn.");
    }
  };

  return (
    <section className="mt-6">
      <div className="flex flex-wrap gap-2">
        {[["upcoming", "Sắp đón"], ["done", "Hoàn thành"], ["canceled", "Đã hủy"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === k ? "bg-[#173b31] text-white" : "bg-white text-stone-600"}`}>
            {l}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="mt-5 rounded-3xl bg-white p-8 text-center text-stone-500">Không có đơn nào.</p>}
      <div className="mt-5 grid gap-3">
        {shown.map((b) => {
          const status = TRANSFER_STATUS[b.status];
          const canComplete = b.status === "Confirmed" && new Date(b.serviceDate).toISOString().slice(0, 10) <= today;
          return (
            <article key={b._id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-400">#{b._id.slice(-6).toUpperCase()} · {b.vehicleTypeId?.name} × {b.vehicles}</p>
                  <h3 className="mt-0.5 font-bold text-[#173b31]">{b.routeId?.fromPlace} → {b.routeId?.toPlace}</h3>
                  <p className="mt-1 text-sm font-semibold text-stone-700">{formatPickup(b.pickupTime)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
              </div>
              <div className="mt-3 grid gap-1 text-sm text-stone-600 sm:grid-cols-3">
                <p>Khách: <b>{b.customerId?.fullName || "—"}</b> · {b.passengers} người</p>
                <p>Liên hệ: <b>{b.contactPhone}</b></p>
                <p>Chuyến bay: <b>{b.flightNumber || "—"}</b></p>
              </div>
              {b.note && <p className="mt-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Ghi chú: {b.note}</p>}
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
                <p className="font-extrabold text-[#b7812d]">{formatVnd(b.totalAmount)}</p>
                {canComplete && (
                  <button onClick={() => complete(b)} className="rounded-xl bg-[#173b31] px-4 py-2 text-sm font-bold text-white hover:bg-[#245a4b]">
                    Đã đón khách
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function TransportDashboard() {
  const [company, setCompany] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState("vehicles");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const reload = useCallback(
    () =>
      Promise.all([API.get("/transport/my-company"), API.get("/transport/vehicles"), API.get("/transport/bookings")])
        .then(([c, v, b]) => {
          setCompany(c.data.data);
          setVehicles(v.data.data);
          setBookings(b.data.data);
          setSummary(b.data.summary);
        })
        .catch((e) => setError(e.response?.data?.message || "Không thể tải dữ liệu nhà xe."))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const notify = (msg) => {
    if (!msg) return;
    setToast(msg);
    window.setTimeout(() => setToast(""), 3000);
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center font-bold text-[#173b31]">Đang tải trung tâm nhà xe...</div>;
  if (error || !company) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5 text-center">
        <div>
          <p role="alert" className="font-semibold text-red-700">{error || "Bạn chưa có hồ sơ nhà xe."}</p>
          <Link to="/transport-apply" className="mt-4 inline-block rounded-xl bg-[#173b31] px-5 py-3 font-bold text-white">Đăng ký nhà xe</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] px-4 py-8 sm:px-5 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-bold uppercase tracking-widest text-[#b7812d]">Trung tâm nhà xe</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-[#173b31] sm:text-4xl">{company.companyName}</h1>
        <p className="mt-2 text-sm text-stone-500">
          GP {company.licenseNumber} · {company.phone} · Phục vụ: {company.serviceProvinces.join(", ")}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard icon="car" label="Đón hôm nay" value={summary?.pickupsToday ?? 0} note="Chuyến đã thanh toán" />
          <StatCard icon="calendar" label="7 ngày tới" value={summary?.upcoming7Days ?? 0} note="Chuyến sắp đón" />
          <StatCard icon="check" label="Đơn tháng này" value={summary?.bookingsThisMonth ?? 0} note="Không tính đơn hủy" />
          <StatCard icon="wallet" label="Doanh thu tháng" value={formatVndShort(summary?.revenueThisMonth)} note="Đơn đã thanh toán" />
        </div>

        <div className="mt-8 flex max-w-full overflow-x-auto rounded-full bg-stone-200/70 p-1 sm:w-fit">
          <button onClick={() => setTab("vehicles")} className={tabClass(tab === "vehicles")}>Loại xe & tuyến ({vehicles.length})</button>
          <button onClick={() => setTab("bookings")} className={tabClass(tab === "bookings")}>Đơn đặt xe ({bookings.filter((b) => b.status === "Confirmed").length})</button>
        </div>

        {tab === "vehicles" ? (
          <VehiclesPanel company={company} vehicles={vehicles} reload={reload} notify={notify} />
        ) : (
          <BookingsPanel bookings={bookings} reload={reload} notify={notify} />
        )}
      </div>

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-[#173b31] px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}
