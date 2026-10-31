// File: src/components/Modal.jsx
// Khung modal dùng chung: trên điện thoại trượt lên từ đáy và chiếm gần hết màn hình,
// trên máy tính hiển thị giữa màn hình. Đóng bằng nút ✕, phím Esc hoặc bấm ra ngoài.
import { useEffect } from "react";

export default function Modal({ title, subtitle, onClose, children, maxWidth = "max-w-2xl" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // khóa cuộn trang phía sau
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-900/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#173b31] sm:text-2xl">{title}</h2>
            {subtitle && <p className="mt-1 truncate text-sm text-stone-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-stone-100 font-bold hover:bg-stone-200"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">{children}</div>
      </div>
    </div>
  );
}
