// File: src/pages/AdminDashboard.jsx
import { useState } from "react";
import Icon from "../components/Icon"; // Hoặc "../components/Icon"
import StatCard from "../components/StatCard";
import API from "../services/api";

const photos = {
  anam: "https://images.unsplash.com/photo-1596178065887-1198b6148b2b?auto=format&fit=crop&w=900&q=85",
  pool: "https://images.unsplash.com/photo-1569335468885-d7d1a41e570c?auto=format&fit=crop&w=900&q=85",
  resort: "https://images.unsplash.com/photo-1678913308053-316cee77afe9?auto=format&fit=crop&w=900&q=85",
};

const initialSubmissions = [
  { id: 1, name: "Mây Lang Thang Villa", owner: "Trần Minh Khoa", city: "Đà Lạt", rooms: 8, submitted: "Hôm nay, 09:42", image: photos.resort, status: "pending" },
  { id: 2, name: "Casa Marina Quy Nhơn", owner: "Nguyễn Hà My", city: "Quy Nhơn", rooms: 14, submitted: "Hôm qua, 16:20", image: photos.pool, status: "pending" },
  { id: 3, name: "The Fern Hội An", owner: "Lê Hoàng Nam", city: "Hội An", rooms: 6, submitted: "18 thg 6, 11:05", image: photos.anam, status: "pending" },
];

export default function AdminDashboard() {
  const [items, setItems] = useState(initialSubmissions);
  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersError, setPartnersError] = useState("");
  const [reviewingPartnerId, setReviewingPartnerId] = useState("");
  const [tab, setTab] = useState("hotels");
  const [toast, setToast] = useState("");

  const loadPartnerApplications = async () => {
    setPartnersLoading(true);
    setPartnersError("");
    try {
      const response = await API.get("/partner/applications/pending");
      setPartners(response.data.data);
    } catch (error) {
      setPartnersError(
        error.response?.data?.message ||
          "Không thể tải yêu cầu làm shop. Vui lòng thử lại.",
      );
    } finally {
      setPartnersLoading(false);
    }
  };

  const decide = (id, decision) => {
    const property = items.find((item) => item.id === id);
    setItems(items.filter((item) => item.id !== id));
    setToast(`${property?.name} đã được ${decision}.`);
  };

  const decidePartner = async (partner, decision) => {
    setReviewingPartnerId(partner._id);
    setPartnersError("");
    try {
      const response = await API.put(
        `/partner/applications/${partner._id}/${decision}`,
      );
      setPartners((current) =>
        current.filter((item) => item._id !== partner._id),
      );
      setToast(response.data.message);
    } catch (error) {
      setPartnersError(
        error.response?.data?.message ||
          "Không thể xét duyệt yêu cầu. Vui lòng thử lại.",
      );
    } finally {
      setReviewingPartnerId("");
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#b7812d]">
              <Icon name="shield" size={17} /> KHU VỰC QUẢN TRỊ
            </div>
            <h1 className="font-display mt-3 text-4xl font-semibold text-[#173b31]">Trung tâm phê duyệt</h1>
            <p className="mt-2 text-stone-500">Quản lý đối tác và các chỗ nghỉ được phép xuất hiện trên Nestly.</p>
          </div>
          <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm">
            <span className="size-2 rounded-full bg-emerald-500" /> Hệ thống hoạt động tốt
          </div>
        </div>

        {toast && (
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <span className="flex items-center gap-2">
              <Icon name="check" />
              {toast}
            </span>
            <button onClick={() => setToast("")}>Đóng</button>
          </div>
        )}

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="clock" label="Khách sạn chờ duyệt" value={String(items.length + 21)} note="5 hồ sơ mới hôm nay" />
          <StatCard icon="check" label="Đã duyệt tháng này" value="148" note="Trung bình 18 giờ / hồ sơ" />
          <StatCard icon="home" label="Tổng chỗ nghỉ" value="12.486" note="↑ 6,2% trong 30 ngày" />
          <StatCard icon="users" label="Đơn partner chờ duyệt" value={partnersLoading ? "..." : String(partners.length)} note="Yêu cầu làm shop" />
        </div>

        <div className="mt-8 flex w-fit rounded-full bg-stone-200/70 p-1">
          <button
            onClick={() => setTab("hotels")}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
              tab === "hotels" ? "bg-white text-[#173b31] shadow-sm" : "text-stone-500"
            }`}
          >
            Duyệt khách sạn <span className="ml-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs">{items.length}</span>
          </button>
          <button
            onClick={() => {
              setTab("partners");
              loadPartnerApplications();
            }}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
              tab === "partners" ? "bg-white text-[#173b31] shadow-sm" : "text-stone-500"
            }`}
          >
            Duyệt partner <span className="ml-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs">{partners.length}</span>
          </button>
        </div>

        {tab === "partners" && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-200 p-6">
              <h2 className="font-display text-2xl font-semibold text-[#173b31]">Đơn đăng ký trở thành partner</h2>
              <p className="mt-1 text-sm text-stone-500">Kiểm tra thông tin chủ sở hữu trước khi cấp quyền đăng chỗ nghỉ.</p>
            </div>
            <div className="divide-y divide-stone-100">
              {partnersError && (
                <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {partnersError}
                  <button
                    type="button"
                    onClick={loadPartnerApplications}
                    className="ml-3 underline"
                  >
                    Tải lại
                  </button>
                </div>
              )}
              {partnersLoading ? (
                <div className="p-14 text-center text-stone-500">Đang tải yêu cầu...</div>
              ) : partners.length === 0 && !partnersError ? (
                <div className="p-14 text-center text-stone-500">Tất cả đơn đăng ký partner đã được xử lý.</div>
              ) : partners.map((partner) => (
                <article key={partner._id} className="grid gap-5 p-6 lg:grid-cols-[56px_1fr_auto] lg:items-center">
                  <span className="grid size-14 place-items-center rounded-full bg-[#e8f2ed] font-display text-lg text-[#173b31]">
                    {partner.fullName.split(" ").slice(-2).map((word) => word[0]).join("")}
                  </span>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-stone-900">{partner.fullName}</h3>
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-extrabold text-amber-700">
                        CHỜ DUYỆT
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-stone-500">{partner.email}{partner.phone ? ` · ${partner.phone}` : ""}</p>
                    <p className="mt-2 text-xs text-stone-400">
                      Gửi lúc {new Date(partner.createdAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => decidePartner(partner, "reject")}
                      disabled={reviewingPartnerId === partner._id}
                      className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50"
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      onClick={() => decidePartner(partner, "approve")}
                      disabled={reviewingPartnerId === partner._id}
                      className="flex items-center gap-2 rounded-full bg-[#173b31] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#245a4b] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Icon name="check" size={16} />
                      {reviewingPartnerId === partner._id ? "Đang xử lý..." : "Duyệt partner"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "hotels" && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-stone-200 p-6 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-2xl font-semibold text-[#173b31]">Hồ sơ chờ xét duyệt</h2>
                <p className="mt-1 text-sm text-stone-500">Ưu tiên hồ sơ đã chờ lâu nhất</p>
              </div>
              <div className="flex rounded-full bg-stone-100 p-1 text-xs font-bold">
                <button className="rounded-full bg-white px-4 py-2 shadow-sm">Tất cả</button>
                <button className="px-4 py-2 text-stone-500">Cần bổ sung</button>
              </div>
            </div>
            <div className="divide-y divide-stone-100">
              {items.length === 0 && (
                <div className="p-16 text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                    <Icon name="check" size={25} />
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-semibold text-[#173b31]">Đã xử lý hết!</h3>
                  <p className="mt-2 text-sm text-stone-500">Không còn hồ sơ nào trong danh sách này.</p>
                </div>
              )}
              {items.map((item) => (
                <article key={item.id} className="grid gap-5 p-5 lg:grid-cols-[100px_1fr_auto] lg:items-center lg:p-6">
                  <img src={item.image} alt={item.name} className="h-24 w-full rounded-xl object-cover lg:w-24" />
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-display text-xl font-semibold text-[#173b31]">{item.name}</h3>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-700">
                        MỚI
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-stone-500">
                      {item.city} · {item.rooms} phòng · Chủ sở hữu: {item.owner}
                    </p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-stone-400">
                      <Icon name="clock" size={14} /> Gửi lúc {item.submitted}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-full border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50">
                      Xem hồ sơ
                    </button>
                    <button
                      onClick={() => decide(item.id, "từ chối")}
                      className="rounded-full border border-[#c76b55]/30 px-4 py-2.5 text-sm font-bold text-[#a44f3c] hover:bg-red-50"
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={() => decide(item.id, "phê duyệt")}
                      className="flex items-center gap-2 rounded-full bg-[#173b31] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#245a4b]"
                    >
                      <Icon name="check" size={16} /> Phê duyệt
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}