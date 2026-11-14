// File: src/constants/transfer.js - hằng số / hàm tiện ích dùng chung cho tính năng xe đưa đón

export const VEHICLE_AMENITIES = [
  "Điều hòa",
  "Wi-Fi",
  "Nước uống miễn phí",
  "Ghế trẻ em",
  "Cổng sạc USB",
  "Đón tận sảnh sân bay",
  "Tài xế nói tiếng Anh",
  "Hỗ trợ hành lý",
];

export const TRANSFER_STATUS = {
  Pending: { label: "Chờ thanh toán", className: "bg-amber-100 text-amber-800" },
  Confirmed: { label: "Đã xác nhận", className: "bg-emerald-100 text-emerald-800" },
  Completed: { label: "Hoàn thành", className: "bg-sky-100 text-sky-800" },
  Canceled: { label: "Đã hủy", className: "bg-stone-200 text-stone-600" },
};

export const formatVnd = (n) => `${Number(n || 0).toLocaleString("vi-VN")}₫`;

// Dạng gọn cho thẻ thống kê: 1.530.000 -> "1,53 tr₫"
export const formatVndShort = (n) =>
  Number(n) >= 1e6 ? `${(Number(n) / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tr₫` : formatVnd(n);

// Ngày giờ theo giờ Việt Nam
export const formatPickup = (value) =>
  new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

// YYYY-MM-DD của ngày (giờ VN) cách hôm nay n ngày
export const vnDateKey = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000 + 7 * 3600000).toISOString().slice(0, 10);

export const newIdempotencyKey = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
