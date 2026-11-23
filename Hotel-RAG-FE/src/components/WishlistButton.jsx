// File: src/components/WishlistButton.jsx - nút trái tim lưu khách sạn vào danh sách yêu thích
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import useWishlist, { toggleWishlist } from "../hooks/useWishlist";

export default function WishlistButton({ hotelId, hotelName, className = "", size = 18, withLabel = false }) {
  const ids = useWishlist();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const saved = ids.has(String(hotelId));

  const onClick = async (e) => {
    // Nút nằm trên thẻ khách sạn (là link) -> không mở trang chi tiết khi bấm trái tim
    e.preventDefault();
    e.stopPropagation();
    if (!localStorage.getItem("nestly_token")) {
      navigate("/login");
      return;
    }
    setBusy(true);
    try {
      await toggleWishlist(hotelId);
    } catch {
      // đã hoàn tác trong toggleWishlist
    } finally {
      setBusy(false);
    }
  };

  const label = saved ? `Bỏ ${hotelName || "khách sạn"} khỏi yêu thích` : `Lưu ${hotelName || "khách sạn"} vào yêu thích`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={saved}
      aria-label={withLabel ? undefined : label}
      title={label}
      className={`flex items-center justify-center gap-2 transition disabled:opacity-70 ${className}`}
    >
      <span className={saved ? "text-rose-500 [&_path]:fill-current" : ""}>
        <Icon name="heart" size={size} />
      </span>
      {withLabel && <span>{saved ? "Đã lưu" : "Lưu yêu thích"}</span>}
    </button>
  );
}
