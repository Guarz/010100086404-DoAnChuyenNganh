// File: src/pages/HotelDetail.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Icon from "../components/Icon";
import HotelReviews from "../components/HotelReviews";
import API from "../services/api";

const photos = {
  hero: "https://images.unsplash.com/photo-1615722440048-da4ccf6de048?auto=format&fit=crop&w=1800&q=88",
};

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function HotelDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation(); // Hook lấy query params từ URL

  // Trích xuất dữ liệu từ thanh tìm kiếm (nếu có)
  const queryParams = new URLSearchParams(location.search);
  const searchCheckIn = queryParams.get("checkIn");
  const searchCheckOut = queryParams.get("checkOut");
  const searchRooms = queryParams.get("rooms");

  const [rooms, setRooms] = useState([]);
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form Đặt phòng tự động lấy dữ liệu từ URL hoặc gán mặc định
  const [bookingRoomId, setBookingRoomId] = useState("");
  const [checkInDate, setCheckInDate] = useState(
    () => searchCheckIn || toDateInputValue(new Date()),
  );
  const [checkOutDate, setCheckOutDate] = useState(() => {
    if (searchCheckOut) return searchCheckOut;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toDateInputValue(tomorrow);
  });
  const [roomQuantity, setRoomQuantity] = useState(searchRooms || 1);
  const [specialRequests, setSpecialRequests] = useState("");

  // State xử lý trạng thái
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  // Khóa chống đặt trùng: giữ nguyên khi khách bấm lại / mạng gửi lại cùng một lần đặt
  const idempotencyKeyRef = useRef("");

  const handleBooking = async (event) => {
    event.preventDefault();
    setBookingError("");

    const token = localStorage.getItem("nestly_token");
    if (!token) {
      setBookingError("Vui lòng đăng nhập để tiếp tục đặt phòng.");
      return;
    }

    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      setBookingError("Ngày trả phòng phải sau ngày nhận phòng.");
      return;
    }

    const selectedRoom = rooms.find((room) => room._id === bookingRoomId);
    if (!selectedRoom) {
      setBookingError("Vui lòng chọn loại phòng muốn đặt.");
      return;
    }

    setBookingLoading(true);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    try {
      const response = await API.post("/bookings", {
        hotelId: hotel._id,
        checkInDate,
        checkOutDate,
        bookingDetails: [
          { roomTypeId: selectedRoom._id, quantity: Number(roomQuantity) },
        ],
        specialRequests,
      }, { headers: { "Idempotency-Key": idempotencyKeyRef.current } });
      idempotencyKeyRef.current = "";
      navigate(`/checkout/${response.data.data._id}`);
    } catch (error) {
      setBookingError(
        error.response?.data?.message ||
          "Không thể đặt phòng lúc này. Vui lòng thử lại.",
      );
    } finally {
      setBookingLoading(false);
    }
  };

  useEffect(() => {
    API.get(`/hotels/${id}`)
      .then((res) => {
        if (res.data.success) setHotel(res.data.data);
        setLoading(false);
      })
      .catch((err) => console.error(err));
  }, [id]);

  // 2. Tải danh sách Hạng phòng (Tự động chạy lại khi khách đổi Ngày Nhận/Trả)
  useEffect(() => {
    if (!checkInDate || !checkOutDate) return;
    API.get(
      `/hotels/${id}/rooms?checkIn=${checkInDate}&checkOut=${checkOutDate}`,
    )
      .then((res) => {
        if (res.data.success) setRooms(res.data.data);
      })
      .catch((err) => console.error(err));
  }, [id, checkInDate, checkOutDate]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center font-bold text-[#173b31]">
        Đang tải dữ liệu khách sạn...
      </div>
    );
  if (!hotel)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-stone-700">
          Không tìm thấy khách sạn này
        </h2>
        <button
          onClick={() => navigate("/hotels")}
          className="mt-4 text-[#173b31] underline"
        >
          Quay lại danh sách
        </button>
      </div>
    );

  return (
    <main className="bg-[#fffdf9]">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-8 lg:px-8">
        <button
          onClick={() => navigate(-1)} // Quay lại trang trước kèm bộ lọc URL
          className="mb-7 flex items-center gap-2 text-sm font-bold text-stone-500 transition hover:text-[#173b31]"
        >
          ← Quay lại
        </button>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#d09b42]">
              {hotel.reviewCount > 0 ? (
                <>
                  ★ {hotel.rating.toFixed(1)}
                  <span className="text-stone-400">
                    ({hotel.reviewCount} đánh giá) · Nestly Tuyển chọn
                  </span>
                </>
              ) : (
                <span className="text-stone-400">Nestly Tuyển chọn · Chưa có đánh giá</span>
              )}
            </div>
            <h1 className="font-display mt-2 text-4xl font-semibold text-[#173b31] sm:text-5xl">
              {hotel.hotelName}
            </h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-stone-500">
              <Icon name="location" size={16} /> {hotel.address?.street},{" "}
              {hotel.address?.city}, {hotel.address?.province}
            </p>
          </div>
        </div>

        {/* THƯ VIỆN ẢNH */}
        <section className="mt-8 grid h-[520px] grid-cols-4 grid-rows-2 gap-3 overflow-hidden rounded-2xl">
          <img
            src={hotel.images?.[0] || photos.hero}
            alt="Ảnh chính"
            className="col-span-4 row-span-1 size-full object-cover md:col-span-2 md:row-span-2"
          />
          <img
            src={
              hotel.images?.[1] ||
              "https://images.unsplash.com/photo-1569335468885-d7d1a41e570c?w=900"
            }
            alt="Ảnh phụ 1"
            className="hidden size-full object-cover md:block"
          />
          <img
            src={
              hotel.images?.[2] ||
              "https://images.unsplash.com/photo-1678913308053-316cee77afe9?w=900"
            }
            alt="Ảnh phụ 2"
            className="hidden size-full object-cover md:block"
          />
          <img
            src={
              hotel.images?.[3] ||
              "https://images.unsplash.com/photo-1772006807170-5750a2aa3713?w=900"
            }
            alt="Ảnh phụ 3"
            className="hidden size-full object-cover md:block"
          />
          <div className="relative hidden md:block">
            <img
              src={hotel.images?.[4] || photos.hero}
              alt="Ảnh phụ 4"
              className="size-full object-cover"
            />
            <button className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-2 text-xs font-bold shadow transition hover:bg-stone-100">
              Xem tất cả {hotel.images?.length || 5} ảnh
            </button>
          </div>
        </section>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_380px]">
          {/* CỘT TRÁI: THÔNG TIN KS */}
          <div>
            <div className="flex items-start justify-between border-b border-stone-200 pb-8">
              <h2 className="font-display text-3xl font-semibold text-[#173b31]">
                Giới thiệu về chỗ nghỉ
              </h2>
              <span className="grid size-12 place-items-center rounded-full bg-[#e8f2ed] text-[#173b31]">
                <Icon name="sparkle" />
              </span>
            </div>
            <p className="border-b border-stone-200 py-8 leading-8 text-stone-600 whitespace-pre-line">
              {hotel.description}
            </p>

            <div className="border-b border-stone-200 py-8">
              <h2 className="font-display text-2xl font-semibold text-[#173b31]">
                Nơi này có gì
              </h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {hotel.amenities?.length > 0 ? (
                  hotel.amenities.map((item, index) => (
                    <p
                      key={index}
                      className="flex items-center gap-3 text-sm font-semibold text-stone-600"
                    >
                      <span className="text-[#b7812d]">
                        <Icon name="check" size={18} />
                      </span>
                      {item}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">
                    Đang cập nhật tiện ích...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: CHỌN PHÒNG & ĐẶT */}
          <div className="flex flex-col gap-6">
            <h2 className="font-display text-2xl font-semibold text-[#173b31]">
              Chọn phòng của bạn
            </h2>

            {rooms.length === 0 ? (
              <p className="text-stone-500 italic">
                Khách sạn này hiện chưa có hạng phòng nào được mở bán.
              </p>
            ) : (
              rooms.map((room) => (
                <aside
                  key={room._id}
                  className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex flex-col gap-4">
                    <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-stone-100 shrink-0">
                      <img
                        src={
                          room.images?.[0] ||
                          "https://images.unsplash.com/photo-1569335468885-d7d1a41e570c?w=600"
                        }
                        alt={room.title}
                        className="size-full object-cover"
                      />
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-[#173b31]">
                        {room.title}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-xs font-semibold bg-stone-100 px-2 py-1 rounded">
                          Tối đa {room.maxAdults} NL, {room.maxChildren} TE
                        </span>
                      </div>

                      <div className="flex flex-wrap items-end justify-between mt-5 pt-5 border-t border-stone-100 gap-4">
                        <div>
                          <p className="text-xs text-stone-400">
                            Giá phòng tham khảo/đêm
                          </p>
                          <p>
                            <strong className="text-2xl text-[#b7812d]">
                              {(
                                room.dynamicPrice || room.basePrice
                              ).toLocaleString("vi-VN")}
                              ₫
                            </strong>
                          </p>
                          {room.availableRooms !== undefined && (
                            <p className="mt-1 text-xs font-bold text-red-500">
                              Chỉ còn {room.availableRooms} phòng
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBookingRoomId(room._id);
                            setBookingError("");
                          }}
                          className={`rounded-xl px-6 py-3 font-bold transition ${bookingRoomId === room._id ? "bg-[#b7812d] text-white" : "bg-[#173b31] text-white hover:bg-[#245a4b]"}`}
                        >
                          {bookingRoomId === room._id
                            ? "Đang chọn"
                            : "Đặt phòng"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* FORM NHẬP THÔNG TIN (Mở ra khi bấm Chọn phòng) */}
                  {bookingRoomId === room._id && (
                    <form
                      onSubmit={handleBooking}
                      className="mt-6 grid gap-4 border-t border-stone-100 pt-6 sm:grid-cols-2"
                    >
                      <label className="text-sm font-semibold text-stone-700">
                        Ngày nhận phòng{" "}
                        <input
                          type="date"
                          required
                          min={toDateInputValue(new Date())}
                          value={checkInDate}
                          onChange={(e) => setCheckInDate(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-semibold text-stone-700">
                        Ngày trả phòng{" "}
                        <input
                          type="date"
                          required
                          min={checkInDate}
                          value={checkOutDate}
                          onChange={(e) => setCheckOutDate(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-semibold text-stone-700">
                        Số phòng{" "}
                        <input
                          type="number"
                          required
                          min="1"
                          step="1"
                          value={roomQuantity}
                          onChange={(e) => setRoomQuantity(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                        />
                      </label>
                      <label className="text-sm font-semibold text-stone-700 sm:col-span-2">
                        Yêu cầu đặc biệt{" "}
                        <textarea
                          value={specialRequests}
                          onChange={(e) => setSpecialRequests(e.target.value)}
                          rows="2"
                          className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                        />
                      </label>

                      {bookingError && (
                        <p className="text-sm font-semibold text-red-600 sm:col-span-2">
                          {bookingError}
                        </p>
                      )}

                      <div className="sm:col-span-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setBookingRoomId("")}
                          className="rounded-xl px-6 py-3 font-bold text-stone-500 transition hover:bg-stone-100"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={bookingLoading}
                          className="flex-1 rounded-xl bg-[#173b31] px-6 py-3 font-bold text-white transition hover:bg-[#245a4b] disabled:opacity-60"
                        >
                          {bookingLoading ? "Đang xử lý..." : "Xác nhận đặt"}
                        </button>
                      </div>
                    </form>
                  )}
                </aside>
              ))
            )}
          </div>
        </div>

        <HotelReviews hotelId={id} />
      </div>
    </main>
  );
}
