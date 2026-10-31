// File: src/components/HotelReviews.jsx
// Khối "Đánh giá của khách" trên trang chi tiết khách sạn
import { useEffect, useState } from "react";
import StarRating from "./StarRating";
import API from "../services/api";

export default function HotelReviews({ hotelId }) {
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    API.get(`/reviews/hotel/${hotelId}`)
      .then((res) => {
        if (ignore) return;
        setSummary(res.data.summary);
        setReviews(res.data.data);
      })
      .catch((err) => {
        if (!ignore) setError(err.response?.data?.message || "Không thể tải đánh giá.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [hotelId]);

  return (
    <section className="mt-16 border-t border-stone-200 pt-12">
      <h2 className="font-display text-3xl font-semibold text-[#173b31]">
        Đánh giá của khách
      </h2>

      {loading ? (
        <p className="mt-6 text-sm text-stone-500">Đang tải đánh giá...</p>
      ) : error ? (
        <p className="mt-6 text-sm font-semibold text-red-600">{error}</p>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[280px_1fr]">
          <div className="h-fit rounded-2xl border border-stone-200 bg-white p-6">
            <p className="font-display text-5xl font-semibold text-[#173b31]">
              {summary.reviewCount ? summary.rating.toFixed(1) : "—"}
              <span className="text-lg text-stone-400"> / 5</span>
            </p>
            <div className="mt-2">
              <StarRating value={summary.rating} size={20} />
            </div>
            <p className="mt-2 text-sm text-stone-500">
              {summary.reviewCount} lượt đánh giá đã xác thực
            </p>
            <div className="mt-5 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.stars[star] || 0;
                const percent = summary.reviewCount ? (count / summary.reviewCount) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="w-8 font-semibold">{star} ★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <span
                        className="block h-full rounded-full bg-[#d09b42]"
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 p-10 text-center text-sm text-stone-500">
              Chưa có đánh giá nào. Khách đã hoàn tất kỳ nghỉ có thể đánh giá trong mục
              Lịch sử đặt chỗ.
            </div>
          ) : (
            <div className="space-y-5">
              {reviews.map((review) => (
                <article key={review._id} className="rounded-2xl border border-stone-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-full bg-[#e8f2ed] text-sm font-bold text-[#173b31]">
                        {review.customerName.trim().split(" ").pop()?.[0]?.toUpperCase()}
                      </span>
                      <div>
                        <p className="font-bold text-stone-900">{review.customerName}</p>
                        <p className="text-xs text-stone-400">
                          {review.roomTitles.join(", ")}
                          {review.stayDate &&
                            ` · Lưu trú ${new Date(review.stayDate).toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" })}`}
                        </p>
                      </div>
                    </div>
                    <StarRating value={review.rating} size={16} />
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-600">
                    {review.comment}
                  </p>
                  <p className="mt-3 text-xs text-stone-400">
                    {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
