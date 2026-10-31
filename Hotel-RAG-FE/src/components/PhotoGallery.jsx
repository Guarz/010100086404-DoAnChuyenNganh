// File: src/components/PhotoGallery.jsx
// Xem toàn bộ ảnh (khách sạn hoặc hạng phòng) dạng trình chiếu: nút / phím ← → để chuyển ảnh.
import { useEffect, useState } from "react";
import Modal from "./Modal";

export default function PhotoGallery({ title, images, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const count = images.length;
  const go = (step) => setIndex((i) => (i + step + count) % count);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count]);

  return (
    <Modal title={title} subtitle={`Ảnh ${index + 1} / ${count}`} onClose={onClose} maxWidth="max-w-5xl">
      <div className="relative overflow-hidden rounded-2xl bg-stone-900">
        <img src={images[index]} alt={`${title} - ảnh ${index + 1}`} className="mx-auto max-h-[60vh] w-full object-contain" />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Ảnh trước"
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg font-bold shadow hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Ảnh sau"
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg font-bold shadow hover:bg-white"
            >
              ›
            </button>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Xem ảnh ${i + 1}`}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? "border-[#173b31]" : "border-transparent opacity-70"}`}
            >
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
