// File: src/components/NotificationBell.jsx
// Chuông thông báo trên header: đơn mới, đơn bị hủy, hồ sơ được duyệt...
// Tải lại mỗi 60 giây và mỗi khi quay lại tab (không cần WebSocket).
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

const POLL_MS = 60000;

const TYPE_STYLE = {
  order_new: "bg-emerald-100 text-emerald-700",
  order_paid: "bg-emerald-100 text-emerald-700",
  order_canceled: "bg-red-100 text-red-700",
  order_expired: "bg-amber-100 text-amber-700",
  application_approved: "bg-emerald-100 text-emerald-700",
  application_rejected: "bg-red-100 text-red-700",
  application_submitted: "bg-sky-100 text-sky-700",
};

const timeAgo = (date) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return new Date(date).toLocaleDateString("vi-VN");
};

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    if (!localStorage.getItem("nestly_token")) return;
    API.get("/notifications", { params: { limit: 15 } })
      .then((r) => {
        setItems(r.data.data);
        setUnread(r.data.unreadCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  // Đóng khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.readAt) {
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
      API.put(`/notifications/${n._id}/read`).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    setItems((list) => list.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    setUnread(0);
    API.put("/notifications/read-all").catch(() => {});
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) load();
        }}
        aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-[#173b31] shadow-sm transition hover:border-slate-300 hover:shadow-md"
      >
        <BellIcon />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-5 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-50 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-bold text-slate-900">Thông báo</p>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="text-xs font-bold text-[#b7812d] hover:underline">
                Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Chưa có thông báo nào.</p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto overscroll-contain">
              {items.map((n) => (
                <li key={n._id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${n.readAt ? "" : "bg-[#f2f7f5]"}`}
                  >
                    <span className={`mt-1 size-2.5 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-[#b7812d]"}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">{n.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${TYPE_STYLE[n.type] || "bg-slate-100 text-slate-600"}`}>
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                      {n.message && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{n.message}</span>}
                      {!n.readAt && <span className="sr-only">(chưa đọc)</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
