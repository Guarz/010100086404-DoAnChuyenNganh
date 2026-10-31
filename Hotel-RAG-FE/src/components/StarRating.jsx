// File: src/components/StarRating.jsx
// Hiển thị số sao; truyền onChange để biến thành ô chọn sao (1-5).
import { useState } from "react";

const LABELS = ["", "Tệ", "Không hài lòng", "Bình thường", "Hài lòng", "Tuyệt vời"];

export default function StarRating({ value = 0, onChange, size = 18 }) {
  const [hover, setHover] = useState(0);
  const interactive = typeof onChange === "function";
  const shown = hover || value;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-0.5"
        role={interactive ? "radiogroup" : "img"}
        aria-label={`${value} trên 5 sao`}
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          // Cho phép hiển thị nửa sao khi là điểm trung bình (VD 4.5)
          const fill = Math.max(0, Math.min(1, shown - (star - 1)));
          const icon = (
            <span className="relative inline-block leading-none" style={{ fontSize: size }}>
              <span className="text-stone-300">★</span>
              <span
                className="absolute inset-0 overflow-hidden text-[#d09b42]"
                style={{ width: `${fill * 100}%` }}
              >
                ★
              </span>
            </span>
          );

          return interactive ? (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} sao`}
              onClick={() => onChange(star)}
              onMouseEnter={() => setHover(star)}
              className="transition hover:scale-110"
            >
              {icon}
            </button>
          ) : (
            <span key={star}>{icon}</span>
          );
        })}
      </div>
      {interactive && shown > 0 && (
        <span className="text-xs font-bold text-[#b7812d]">{LABELS[shown]}</span>
      )}
    </div>
  );
}
