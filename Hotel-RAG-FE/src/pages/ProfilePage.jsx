// File: src/pages/ProfilePage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import API from "../services/api";

export default function ProfilePage({ onLogout }) {
  const [active, setActive] = useState("personal");
  const [saved, setSaved] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const navigate = useNavigate();

  const userStr = localStorage.getItem("nestly_user");
  const currentUser = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    if (!currentUser) navigate("/login");
  }, [currentUser, navigate]);

  const fetchBookings = () => {
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

  useEffect(() => {
    if (active === "booking") {
      fetchBookings();
    }
  }, [active]);

  // HÀM MỚI: Xử lý Hủy đơn
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy đơn đặt phòng này? (Quỹ phòng sẽ được hoàn lại hệ thống)")) return;
    
    try {
      const res = await API.put(`/bookings/${bookingId}/cancel`);
      if (res.data.success) {
        alert(res.data.message);
        fetchBookings(); // Tải lại danh sách sau khi hủy thành công
      }
    } catch (error) {
      alert(error.response?.data?.message || "Lỗi khi hủy đơn");
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
    { id: "payment", label: "Phương thức thanh toán", icon: "wallet" },
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
            <div className="border-b border-slate-100 p-6 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#d4a34f] text-xl font-extrabold text-white">
                {avatarText}
              </span>
              <p className="mt-3 font-bold text-slate-900">{currentUser.fullName}</p>
              <p className="mt-1 text-xs text-slate-500">{currentUser.email}</p>
              <span className="mt-3 inline-block rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                {displayRole}
              </span>
            </div>

            <nav className="p-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "booking" && active !== "booking") {
                      setBookingsError("");
                    }
                    setActive(item.id);
                    setSaved(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                    active === item.id ? "bg-[#e8f2ed] text-[#173b31]" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="border-t border-slate-100 p-2">
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
                  <button onClick={() => setSaved(true)} className="rounded-xl bg-[#173b31] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#245a4b]">
                    Lưu thay đổi
                  </button>
                </div>
              </>
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
                              booking.bookingStatus === 'Cancelled' ? 'bg-red-50 text-red-700' :
                              'bg-amber-50 text-amber-800'
                            }`}>
                              {{
                                Pending: "Chờ thanh toán",
                                Confirmed: "Đã thanh toán",
                                Cancelled: "Đã hủy"
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

                          <div className="mt-auto pt-4 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100">
                            <div className="flex gap-2">
                              {/* NÚT THANH TOÁN (Chuyển sang trang Checkout) */}
                              {booking.bookingStatus === "Pending" && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/checkout/${booking._id}`)}
                                  className="rounded-xl bg-[#173b31] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#245a4b]"
                                >
                                  Thanh toán ngay
                                </button>
                              )}
                              {/* NÚT HỦY ĐƠN */}
                              {(booking.bookingStatus === "Pending" || booking.bookingStatus === "Confirmed") && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelBooking(booking._id)}
                                  className="rounded-xl bg-red-50 text-red-600 border border-red-100 px-4 py-2 text-sm font-bold transition hover:bg-red-100"
                                >
                                  Hủy đơn
                                </button>
                              )}
                            </div>
                            <p className="text-right font-bold text-[#173b31] text-lg">
                              {booking.totalAmount.toLocaleString("vi-VN")}₫
                            </p>
                          </div>
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