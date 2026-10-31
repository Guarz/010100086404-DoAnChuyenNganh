// File: src/pages/ProfilePage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import StarRating from "../components/StarRating";
import API from "../services/api";

export default function ProfilePage({ onLogout }) {
  const [active, setActive] = useState("personal");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [reviewingId, setReviewingId] = useState(""); // Đơn đang mở form đánh giá
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const navigate = useNavigate();

  const userStr = localStorage.getItem("nestly_user");
  const currentUser = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    if (!currentUser) navigate("/login");
  }, [currentUser, navigate]);

  const fetchBookings = () => {
    setBookingsLoading(true);
    setBookingsError("");
    API.get("/bookings/my-bookings")
      .then((response) => {
        setBookings(response.data.data);
      })
      .catch((error) => {
        setBookingsError(error.response?.data?.message || "Không thể tải lịch sử đặt chỗ.");
      })
      .finally(() => {
        setBookingsLoading(false);
      });
  };

  const openReviewForm = (bookingId) => {
    setReviewingId(bookingId);
    setReviewForm({ rating: 0, comment: "" });
    setReviewError("");
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (reviewForm.rating < 1) {
      setReviewError("Vui lòng chọn số sao.");
      return;
    }
    setReviewSubmitting(true);
    setReviewError("");
    try {
      const response = await API.post("/reviews", {
        bookingId: reviewingId,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      });
      // Gắn review vừa tạo vào đơn để ẩn form và hiển thị kết quả ngay
      setBookings((current) =>
        current.map((booking) =>
          booking._id === reviewingId
            ? { ...booking, review: response.data.data }
            : booking,
        ),
      );
      setReviewingId("");
    } catch (error) {
      setReviewError(error.response?.data?.message || "Không thể gửi đánh giá.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Lưu họ tên / số điện thoại qua API thật và cập nhật lại thông tin trong localStorage
  const saveProfile = async () => {
    setSaving(true);
    setSaved(false);
    setProfileError("");
    try {
      const response = await API.put("/users/me", {
        fullName: formData.fullName,
        phone: formData.phone,
      });
      const updated = response.data.data;
      localStorage.setItem(
        "nestly_user",
        JSON.stringify({ ...currentUser, fullName: updated.fullName, phone: updated.phone }),
      );
      setSaved(true);
    } catch (error) {
      setProfileError(error.response?.data?.message || "Không thể lưu thông tin.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage({ type: "", text: "" });
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: "error", text: "Mật khẩu xác nhận không khớp." });
      return;
    }
    setPasswordSaving(true);
    try {
      const response = await API.put("/users/me/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordMessage({ type: "success", text: response.data.message });
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: error.response?.data?.message || "Không thể đổi mật khẩu.",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const [formData, setFormData] = useState({
    fullName: currentUser?.fullName || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
  });

  if (!currentUser) return null;

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };
  
  const avatarText = getInitials(currentUser.fullName);
  const displayRole = currentUser.role === "Partner" ? "ĐỐI TÁC NESTLY" : (currentUser.role === "Admin" ? "QUẢN TRỊ VIÊN" : "THÀNH VIÊN NESTLY");

  const navItems = [
    { id: "personal", label: "Thông tin cá nhân", icon: "users" },
    { id: "security", label: "Mật khẩu & bảo mật", icon: "shield" },
    { id: "booking", label: "Lịch sử đặt chỗ", icon: "calendar" },
  ];

  const handleLogoutClick = () => {
    if (onLogout) onLogout();
    navigate("/");
  };

  return (
    <main className="min-h-screen bg-[#f4f7f6] py-10">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-widest text-[#b7812d]">Tài khoản của tôi</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#173b31]">Quản lý thông tin cá nhân</h1>
        </div>

        {saved && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <Icon name="check" /> Thông tin của bạn đã được cập nhật.
          </div>
        )}

        <div className="grid gap-7 lg:grid-cols-[270px_1fr]">
          <aside className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-4 border-b border-slate-100 p-4 lg:block lg:p-6 lg:text-center">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#d4a34f] text-lg font-extrabold text-white lg:mx-auto lg:size-16 lg:text-xl">
                {avatarText}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900 lg:mt-3">{currentUser.fullName}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{currentUser.email}</p>
                <span className="mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 lg:mt-3">
                  {displayRole}
                </span>
              </div>
            </div>

            <nav className="flex gap-1 overflow-x-auto p-2 lg:block">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "booking") {
                      setBookingsError("");
                      fetchBookings();
                    }
                    setActive(item.id);
                    setSaved(false);
                  }}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition lg:w-full lg:gap-3 lg:px-4 lg:py-3 ${
                    active === item.id ? "bg-[#e8f2ed] text-[#173b31]" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="hidden border-t border-slate-100 p-2 lg:block">
              <button onClick={handleLogoutClick} className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50">
                Đăng xuất
              </button>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {active === "personal" && (
              <>
                <div className="border-b border-slate-100 pb-6">
                  <h2 className="text-xl font-bold text-slate-900">Thông tin cá nhân</h2>
                  <p className="mt-2 text-sm text-slate-500">Thông tin này được sử dụng cho các đơn đặt phòng của bạn.</p>
                </div>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-bold text-slate-700 sm:col-span-2">
                    Họ và tên
                    <input value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#173b31]" />
                  </label>
                  <label className="text-sm font-bold text-slate-700">
                    Email
                    <input value={formData.email} disabled className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal text-slate-500 outline-none cursor-not-allowed" />
                  </label>
                  <label className="text-sm font-bold text-slate-700">
                    Số điện thoại
                    <input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="Chưa cập nhật" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#173b31]" />
                  </label>
                </div>
                <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
                  {profileError && (
                    <p role="alert" className="mr-auto self-center text-sm font-semibold text-red-600">{profileError}</p>
                  )}
                  <button onClick={saveProfile} disabled={saving} className="rounded-xl bg-[#173b31] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#245a4b] disabled:opacity-60">
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </>
            )}
            
            {active === "security" && (
              <form onSubmit={changePassword}>
                <div className="border-b border-slate-100 pb-6">
                  <h2 className="text-xl font-bold text-slate-900">Mật khẩu & bảo mật</h2>
                  <p className="mt-2 text-sm text-slate-500">Mật khẩu mới cần ít nhất 8 ký tự.</p>
                </div>
                <div className="mt-7 grid max-w-md gap-5">
                  {[
                    ["currentPassword", "Mật khẩu hiện tại", "current-password"],
                    ["newPassword", "Mật khẩu mới", "new-password"],
                    ["confirmPassword", "Xác nhận mật khẩu mới", "new-password"],
                  ].map(([name, label, autoComplete]) => (
                    <label key={name} className="text-sm font-bold text-slate-700">
                      {label}
                      <input
                        type="password"
                        required
                        minLength={name === "currentPassword" ? undefined : 8}
                        autoComplete={autoComplete}
                        value={passwordForm[name]}
                        onChange={(e) => setPasswordForm({ ...passwordForm, [name]: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-[#173b31]"
                      />
                    </label>
                  ))}
                </div>
                {passwordMessage.text && (
                  <p role="alert" className={`mt-5 text-sm font-semibold ${passwordMessage.type === "error" ? "text-red-600" : "text-emerald-700"}`}>
                    {passwordMessage.text}
                  </p>
                )}
                <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
                  <button type="submit" disabled={passwordSaving} className="rounded-xl bg-[#173b31] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#245a4b] disabled:opacity-60">
                    {passwordSaving ? "Đang lưu..." : "Đổi mật khẩu"}
                  </button>
                </div>
              </form>
            )}

            {active === "booking" && (
              <section>
                <div className="border-b border-slate-100 pb-6">
                  <h2 className="text-xl font-bold text-slate-900">Lịch sử đặt chỗ</h2>
                  <p className="mt-2 text-sm text-slate-500">Các đơn đặt phòng của tài khoản bạn.</p>
                </div>

                {bookingsLoading ? (
                  <p className="py-8 text-sm font-bold text-slate-500">Đang tải lịch sử đặt chỗ...</p>
                ) : bookingsError ? (
                  <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    {bookingsError}
                  </p>
                ) : bookings.length === 0 ? (
                  <p className="py-8 text-sm font-bold text-slate-500">Bạn chưa có đơn đặt phòng nào.</p>
                ) : (
                  <div className="mt-6 space-y-4">
                    {bookings.map((booking) => (
                      <article
                        key={booking._id}
                        className="flex flex-col gap-5 rounded-2xl border border-slate-200 p-5 sm:flex-row"
                      >
                        <img 
                          src={booking.hotelId?.images?.[0] || "https://images.unsplash.com/photo-1569335468885-d7d1a41e570c?w=400"} 
                          alt="Khách sạn" 
                          className="h-40 w-full rounded-xl object-cover sm:h-auto sm:w-48 bg-slate-100 shrink-0" 
                        />
                        
                        <div className="flex-1 flex flex-col">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-[#173b31]">{booking.hotelId?.hotelName || "Khách sạn"}</h3>
                              <p className="mt-1 text-sm text-slate-500">
                                {[booking.hotelId?.address?.city, booking.hotelId?.address?.province].filter(Boolean).join(", ")}
                              </p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                              booking.bookingStatus === 'Confirmed' ? 'bg-emerald-50 text-emerald-700' :
                              booking.bookingStatus === 'Completed' ? 'bg-sky-50 text-sky-700' :
                              booking.bookingStatus === 'Canceled' ? 'bg-red-50 text-red-700' :
                              'bg-amber-50 text-amber-800'
                            }`}>
                              {{
                                Pending: "Chờ thanh toán",
                                Confirmed: "Đã thanh toán",
                                Canceled: "Đã hủy",
                                Completed: "Đã hoàn thành"
                              }[booking.bookingStatus] || booking.bookingStatus}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                            <p>Nhận phòng: <strong>{new Date(booking.checkInDate).toLocaleDateString("vi-VN")}</strong></p>
                            <p>Trả phòng: <strong>{new Date(booking.checkOutDate).toLocaleDateString("vi-VN")}</strong></p>
                          </div>

                          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                            {booking.bookingDetails.map((detail) => (
                              <p key={detail._id || detail.roomTypeId?._id} className="text-sm text-slate-600">
                                <strong className="text-[#b7812d]">{detail.roomTypeId?.title || "Loại phòng"}</strong> · {detail.quantity} phòng · {detail.totalNights} đêm
                              </p>
                            ))}
                          </div>

                          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                            {booking.bookingStatus === "Completed" && !booking.review && reviewingId !== booking._id ? (
                              <button
                                type="button"
                                onClick={() => openReviewForm(booking._id)}
                                className="flex items-center gap-2 rounded-full border border-[#d09b42]/40 px-4 py-2 text-xs font-bold text-[#b7812d] transition hover:bg-amber-50"
                              >
                                <Icon name="star" size={14} /> Viết đánh giá
                              </button>
                            ) : (
                              <span />
                            )}
                            <p className="ml-auto text-right font-bold text-[#173b31] text-lg">
                              {booking.totalAmount.toLocaleString("vi-VN")}₫
                            </p>
                          </div>

                          {booking.review && (
                            <div className="mt-4 rounded-xl bg-slate-50 p-4">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Đánh giá của bạn</p>
                                <StarRating value={booking.review.rating} size={15} />
                              </div>
                              <p className="mt-2 text-sm text-slate-600">{booking.review.comment}</p>
                            </div>
                          )}

                          {reviewingId === booking._id && (
                            <form onSubmit={submitReview} className="mt-4 space-y-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                              <p className="text-sm font-bold text-slate-800">Kỳ nghỉ của bạn thế nào?</p>
                              <StarRating
                                value={reviewForm.rating}
                                onChange={(rating) => setReviewForm({ ...reviewForm, rating })}
                                size={26}
                              />
                              <textarea
                                value={reviewForm.comment}
                                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                                rows="3"
                                required
                                minLength={5}
                                maxLength={1000}
                                placeholder="Chia sẻ trải nghiệm về phòng, dịch vụ, vị trí..."
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#173b31]"
                              />
                              {reviewError && (
                                <p role="alert" className="text-sm font-semibold text-red-600">{reviewError}</p>
                              )}
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReviewingId("")}
                                  className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="submit"
                                  disabled={reviewSubmitting}
                                  className="rounded-xl bg-[#173b31] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#245a4b] disabled:opacity-60"
                                >
                                  {reviewSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}