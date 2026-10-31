import { useState, useEffect } from "react";
import StatCard from "../components/StatCard";
import PartnerBookings from "../components/PartnerBookings";
import AmenityPicker from "../components/AmenityPicker";
import HotelEditModal from "../components/partner/HotelEditModal";
import RoomManagerModal from "../components/partner/RoomManagerModal";
import {
  HOTEL_AMENITY_SUGGESTIONS,
  ROOM_AMENITY_SUGGESTIONS,
} from "../constants/amenities";
import API from "../services/api";

const photos = {
  city: "https://images.unsplash.com/photo-1772006807170-5750a2aa3713?auto=format&fit=crop&w=900&q=85",
};

export default function PartnerDashboard() {
  const [submitted, setSubmitted] = useState(false);
  const [hotelAmenities, setHotelAmenities] = useState([]);
  const [roomAmenities, setRoomAmenities] = useState([]);
  const [editingHotel, setEditingHotel] = useState(null);
  const [roomsHotel, setRoomsHotel] = useState(null);
  const [notice, setNotice] = useState("");
  const [myHotels, setMyHotels] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [formData, setFormData] = useState({
    hotelName: "",
    description: "",
    street: "",
    city: "",
    province: "",
    amenities: "",
    images: "",
  });
  const [pricingModal, setPricingModal] = useState(null);
  const [hotelRooms, setHotelRooms] = useState([]);
  const [pricingForm, setPricingForm] = useState({
    roomTypeId: "",
    startDate: "",
    endDate: "",
    newPrice: "",
    newQuantity: "",
  });
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSuccess, setPricingSuccess] = useState("");
  const [bookingSummary, setBookingSummary] = useState(null);

  // Lấy thông tin user từ LocalStorage để chào đúng tên
  const user = JSON.parse(localStorage.getItem("nestly_user") || "{}");

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  // === STATE QUẢN LÝ TẠO HẠNG PHÒNG ===
  const [managingHotel, setManagingHotel] = useState(null); // Lưu KS đang được chọn
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [roomSuccess, setRoomSuccess] = useState("");
  const [roomFormData, setRoomFormData] = useState({
    title: "",
    description: "",
    basePrice: "",
    totalQuantity: 1,
    maxAdults: 2,
    maxChildren: 0,
    amenities: "",
    images: "",
  });

  const handleRoomChange = (e) =>
    setRoomFormData({ ...roomFormData, [e.target.name]: e.target.value });

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setRoomLoading(true);
    setRoomError("");
    setRoomSuccess("");

    try {
      const payload = {
        title: roomFormData.title,
        description: roomFormData.description,
        basePrice: Number(roomFormData.basePrice),
        totalQuantity: Number(roomFormData.totalQuantity),
        maxAdults: Number(roomFormData.maxAdults),
        maxChildren: Number(roomFormData.maxChildren),
        amenities: roomAmenities,
        images: roomFormData.images
          .split("\n")
          .map((i) => i.trim())
          .filter(Boolean),
      };

      // Gọi API nối với ID của Khách sạn đang được chọn
      const response = await API.post(
        `/partner/hotels/${managingHotel._id}/rooms`,
        payload,
      );

      if (response.data.success) {
        setRoomSuccess(
          "Tạo phòng thành công! Đã tự động mở bán quỹ phòng cho 30 ngày tới.",
        );
        setRoomFormData({
          title: "",
          description: "",
          basePrice: "",
          totalQuantity: 1,
          maxAdults: 2,
          maxChildren: 0,
          amenities: "",
          images: "",
        });
        setRoomAmenities([]);

        // Đóng Modal sau 3 giây
        setTimeout(() => {
          setRoomSuccess("");
          setManagingHotel(null);
        }, 3000);
      }
    } catch (error) {
      setRoomError(error.response?.data?.message || "Lỗi tạo hạng phòng.");
    } finally {
      setRoomLoading(false);
    }
  };
  const openPricingModal = async (hotel) => {
    setPricingModal(hotel);
    setPricingSuccess("");
    try {
      // TÌM DÒNG NÀY TRONG HÀM openPricingModal:
      const response = await API.get(`/hotels/${hotel._id}/rooms?showAll=true`);
      if (response.data.success) {
        setHotelRooms(response.data.data);
        if (response.data.data.length > 0) {
          setPricingForm((prev) => ({
            ...prev,
            roomTypeId: response.data.data[0]._id,
          }));
        }
      }
    } catch (error) {
      console.error("Lỗi tải danh sách phòng:", error);
    }
  };

  const handleUpdatePricing = async (e) => {
    e.preventDefault();
    setPricingLoading(true);
    try {
      const response = await API.put("/partner/inventory", pricingForm);
      if (response.data.success) {
        setPricingSuccess(response.data.message);
        setTimeout(() => setPricingModal(null), 3000);
      }
    } catch (error) {
      alert(error.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setPricingLoading(false);
    }
  };
  const handleToggleRoom = async () => {
    if (!pricingForm.roomTypeId) return;
    try {
      const response = await API.put(
        `/partner/rooms/${pricingForm.roomTypeId}/toggle`,
      );
      if (response.data.success) {
        // Cập nhật lại UI lập tức
        setHotelRooms((prev) =>
          prev.map((r) =>
            r._id === pricingForm.roomTypeId
              ? { ...r, isActive: response.data.isActive }
              : r,
          ),
        );
        alert(response.data.message);
      }
    } catch (error) {
      alert(
        error.response?.data?.message || "Lỗi khi cập nhật trạng thái phòng",
      );
    }
  };

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const response = await API.get("/partner/hotels");
        if (response.data.success) {
          setMyHotels(response.data.data);
        }
      } catch (error) {
        console.error("Lỗi khi tải danh sách khách sạn:", error);
      } finally {
        setHotelsLoading(false);
      }
    };

    fetchHotels();
  }, []);

  const handleCreateHotel = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");

    try {
      const payload = {
        hotelName: formData.hotelName,
        description: formData.description,
        address: {
          street: formData.street,
          city: formData.city,
          province: formData.province,
        },
        amenities: hotelAmenities,
        images: formData.images
          .split("\n")
          .map((i) => i.trim())
          .filter(Boolean),
      };

      const response = await API.post("/partner/hotels", payload);
      if (response.data.success) {
        setSubmitted(true);
        setIsCreating(false);
        setFormData({
          hotelName: "",
          description: "",
          street: "",
          city: "",
          province: "",
          amenities: "",
          images: "",
        });
        setHotelAmenities([]);

        setMyHotels((prev) => [response.data.data, ...prev]);

        setTimeout(() => setSubmitted(false), 5000);
      }
    } catch (error) {
      setCreateError(error.response?.data?.message || "Lỗi tạo khách sạn.");
    } finally {
      setCreateLoading(false);
    }
  };
  const [inventoryCheck, setInventoryCheck] = useState(null);

  const handleCheckInventory = async () => {
    if (
      !pricingForm.roomTypeId ||
      !pricingForm.startDate ||
      !pricingForm.endDate
    ) {
      return alert(
        "Vui lòng chọn Hạng phòng và khoảng Thời gian trước khi kiểm tra!",
      );
    }
    try {
      const response = await API.get(
        `/partner/inventory/check/${pricingForm.roomTypeId}?startDate=${pricingForm.startDate}&endDate=${pricingForm.endDate}`,
      );
      if (response.data.success) setInventoryCheck(response.data.data);
    } catch (error) {
      console.error(error);
    }
  };
  // Điểm đánh giá trung bình (có trọng số theo số review) của các khách sạn
  const reviewedHotels = myHotels.filter((hotel) => hotel.reviewCount > 0);
  const totalReviews = reviewedHotels.reduce((sum, h) => sum + h.reviewCount, 0);
  const avgRating = totalReviews
    ? reviewedHotels.reduce((sum, h) => sum + h.rating * h.reviewCount, 0) /
      totalReviews
    : 0;

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold text-[#b7812d]">
              TRUNG TÂM ĐỐI TÁC
            </p>
            <h1 className="font-display mt-2 text-4xl font-semibold text-[#173b31]">
              Chào buổi sáng, {user.fullName || "Đối tác"}.
            </h1>
            <p className="mt-2 text-stone-500">
              Đây là tình hình chỗ nghỉ của bạn hôm nay.
            </p>
          </div>

          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center justify-center gap-2 rounded-full bg-[#173b31] px-6 py-3.5 font-bold text-white transition hover:bg-[#245a4b]"
          >
            <span className="text-xl leading-none">
              {isCreating ? "✕" : "+"}
            </span>
            {isCreating ? "Hủy đăng chỗ nghỉ" : "Đăng chỗ nghỉ mới"}
          </button>
        </div>

        {submitted && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            Hồ sơ chỗ nghỉ mới đã được gửi cho Quản trị viên xét duyệt.
          </div>
        )}

        {isCreating && (
          <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <form
              onSubmit={handleCreateHotel}
              className="grid gap-6 sm:grid-cols-2"
            >
              <label className="sm:col-span-2 block text-sm font-bold text-stone-700">
                Tên khách sạn{" "}
                <input
                  name="hotelName"
                  value={formData.hotelName}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>
              <label className="block text-sm font-bold text-stone-700">
                Tỉnh/TP{" "}
                <input
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>
              <label className="block text-sm font-bold text-stone-700">
                Quận/Huyện{" "}
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>
              <label className="sm:col-span-2 block text-sm font-bold text-stone-700">
                Địa chỉ cụ thể{" "}
                <input
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>
              <label className="sm:col-span-2 block text-sm font-bold text-stone-700">
                Mô tả chỗ nghỉ{" "}
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  minLength={10}
                  rows="3"
                  placeholder="Vị trí, phong cách, điểm nổi bật..."
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 font-normal"
                />
              </label>
              <div className="sm:col-span-2">
                <AmenityPicker
                  label="Tiện nghi khách sạn"
                  value={hotelAmenities}
                  onChange={setHotelAmenities}
                  suggestions={HOTEL_AMENITY_SUGGESTIONS}
                />
              </div>
              <label className="sm:col-span-2 block text-sm font-bold text-stone-700">
                Link Hình ảnh (mỗi link 1 dòng){" "}
                <textarea
                  name="images"
                  value={formData.images}
                  onChange={handleChange}
                  rows="3"
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 text-xs"
                />
              </label>
              {createError && (
                <p className="sm:col-span-2 text-sm font-bold text-red-600">
                  {createError}
                </p>
              )}
              <div className="sm:col-span-2 flex justify-end gap-3 mt-2 border-t border-stone-100 pt-6">
                <button
                  type="submit"
                  disabled={createLoading}
                  className="rounded-xl bg-[#173b31] px-6 py-3 font-bold text-white transition hover:bg-[#245a4b] disabled:opacity-60"
                >
                  {createLoading ? "Đang gửi..." : "Gửi yêu cầu duyệt"}
                </button>
              </div>
            </form>
          </section>
        )}

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon="calendar"
            label="Đặt phòng tháng này"
            value={bookingSummary ? String(bookingSummary.bookingsThisMonth) : "..."}
            note={
              bookingSummary
                ? `${bookingSummary.upcoming7Days} lượt khách đến trong 7 ngày tới`
                : "Đang tải..."
            }
          />
          <StatCard
            icon="wallet"
            label="Doanh thu tháng này"
            value={
              bookingSummary
                ? `${bookingSummary.revenueThisMonth.toLocaleString("vi-VN")}₫`
                : "..."
            }
            note="Tính trên đơn đã thanh toán"
          />
          <StatCard
            icon="bed"
            label="Khách đang lưu trú"
            value={bookingSummary ? String(bookingSummary.inHouse) : "..."}
            note={
              bookingSummary
                ? `Hôm nay: ${bookingSummary.arrivalsToday} nhận · ${bookingSummary.departuresToday} trả phòng`
                : "Đang tải..."
            }
          />
          <StatCard
            icon="star"
            label="Điểm đánh giá"
            value={totalReviews ? avgRating.toFixed(1) : "0.0"}
            note={totalReviews ? `Từ ${totalReviews} lượt đánh giá` : "Chưa có đánh giá"}
          />
        </div>

        <div className="mt-8">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold text-[#173b31]">
                  Chỗ nghỉ của bạn
                </h2>
              </div>
            </div>

            {notice && (
              <div className="mt-5 flex items-start justify-between gap-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                <span>{notice}</span>
                <button type="button" onClick={() => setNotice("")} className="shrink-0">
                  Đóng
                </button>
              </div>
            )}

            {hotelsLoading ? (
              <div className="mt-8 text-center text-sm text-stone-500">
                Đang tải danh sách chỗ nghỉ...
              </div>
            ) : myHotels.length === 0 ? (
              <div className="mt-8 text-center text-sm font-bold text-stone-500">
                Bạn chưa đăng chỗ nghỉ nào. Hãy tạo mới ở phía trên!
              </div>
            ) : (
              myHotels.map((hotel) => (
                <div
                  key={hotel._id}
                  className="mt-6 flex flex-col gap-4 border-t border-stone-100 pt-6 lg:flex-row lg:items-center"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
                    <img
                      src={hotel.images?.[0] || photos.city}
                      className="h-40 w-full rounded-xl bg-stone-100 object-cover sm:h-28 sm:w-40 sm:shrink-0"
                      alt={hotel.hotelName}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-stone-900">{hotel.hotelName}</h3>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${hotel.status === "Approved" ? "bg-emerald-50 text-emerald-700" : hotel.status === "Rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
                        >
                          {hotel.status === "Approved"
                            ? "ĐANG HOẠT ĐỘNG"
                            : hotel.status === "Rejected"
                              ? "BỊ TỪ CHỐI"
                              : "CHỜ DUYỆT"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-stone-500">
                        {hotel.address?.street}, {hotel.address?.city}
                      </p>
                      {hotel.status === "Rejected" && hotel.rejectionReason && (
                        <p className="mt-1 text-xs font-semibold text-red-600">
                          Lý do: {hotel.rejectionReason}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(hotel.amenities || []).slice(0, 5).map((a) => (
                          <span key={a} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                            {a}
                          </span>
                        ))}
                        {(hotel.amenities || []).length > 5 && (
                          <span className="text-[11px] font-semibold text-stone-400">
                            +{hotel.amenities.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                    <button
                      onClick={() => setEditingHotel(hotel)}
                      className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold transition hover:bg-stone-50"
                    >
                      Sửa thông tin
                    </button>
                    {hotel.status === "Approved" && (
                      <>
                        <button
                          onClick={() => setRoomsHotel(hotel)}
                          className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold transition hover:bg-stone-50"
                        >
                          Hạng phòng
                        </button>
                        <button
                          onClick={() => setManagingHotel(hotel)}
                          className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold transition hover:bg-stone-50"
                        >
                          + Thêm hạng phòng
                        </button>
                        <button
                          onClick={() => openPricingModal(hotel)}
                          className="rounded-full bg-[#173b31] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#245a4b]"
                        >
                          Giá / Quỹ phòng
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>

        <div className="mt-8">
          <PartnerBookings onSummaryChange={setBookingSummary} />
        </div>
      </div>

      {editingHotel && (
        <HotelEditModal
          hotel={editingHotel}
          onClose={() => setEditingHotel(null)}
          onSaved={(updated, message) => {
            setMyHotels((prev) => prev.map((h) => (h._id === updated._id ? updated : h)));
            setEditingHotel(null);
            setNotice(message);
          }}
        />
      )}
      {roomsHotel && <RoomManagerModal hotel={roomsHotel} onClose={() => setRoomsHotel(null)} />}

      {/* MODAL TẠO HẠNG PHÒNG ĐƯỢC CHÈN VÀO ĐÂY */}
      {managingHotel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-5">
              <div>
                <h2 className="text-2xl font-bold text-[#173b31]">
                  Thêm Hạng phòng mới
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  Khách sạn: <strong>{managingHotel.hotelName}</strong>
                </p>
              </div>
              <button
                onClick={() => setManagingHotel(null)}
                className="grid size-10 place-items-center rounded-full bg-stone-100 font-bold hover:bg-stone-200"
              >
                ✕
              </button>
            </div>

            {roomSuccess && (
              <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                {roomSuccess}
              </div>
            )}

            <form
              onSubmit={handleCreateRoom}
              className="mt-6 grid gap-5 sm:grid-cols-3"
            >
              <label className="sm:col-span-2 block text-sm font-bold text-stone-700">
                Tên hạng phòng *{" "}
                <input
                  name="title"
                  value={roomFormData.title}
                  onChange={handleRoomChange}
                  required
                  placeholder="VD: Phòng Deluxe Hướng Biển"
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>
              <label className="block text-sm font-bold text-stone-700">
                Giá gốc (VNĐ) *{" "}
                <input
                  name="basePrice"
                  type="number"
                  min="0"
                  value={roomFormData.basePrice}
                  onChange={handleRoomChange}
                  required
                  placeholder="VD: 1500000"
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>

              <label className="block text-sm font-bold text-stone-700">
                Tổng số phòng *{" "}
                <input
                  name="totalQuantity"
                  type="number"
                  min="1"
                  value={roomFormData.totalQuantity}
                  onChange={handleRoomChange}
                  required
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>
              <label className="block text-sm font-bold text-stone-700">
                Người lớn tối đa *{" "}
                <input
                  name="maxAdults"
                  type="number"
                  min="1"
                  value={roomFormData.maxAdults}
                  onChange={handleRoomChange}
                  required
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>
              <label className="block text-sm font-bold text-stone-700">
                Trẻ em tối đa{" "}
                <input
                  name="maxChildren"
                  type="number"
                  min="0"
                  value={roomFormData.maxChildren}
                  onChange={handleRoomChange}
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>

              <div className="sm:col-span-3">
                <AmenityPicker
                  label="Tiện nghi phòng"
                  value={roomAmenities}
                  onChange={setRoomAmenities}
                  suggestions={ROOM_AMENITY_SUGGESTIONS}
                />
              </div>

              <label className="sm:col-span-3 block text-sm font-bold text-stone-700">
                Mô tả phòng{" "}
                <textarea
                  name="description"
                  value={roomFormData.description}
                  onChange={handleRoomChange}
                  rows="2"
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>

              <label className="sm:col-span-3 block text-sm font-bold text-stone-700">
                Link ảnh phòng (Mỗi ảnh 1 dòng){" "}
                <textarea
                  name="images"
                  value={roomFormData.images}
                  onChange={handleRoomChange}
                  rows="3"
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 text-xs"
                />
              </label>

              {roomError && (
                <p className="sm:col-span-3 text-sm font-bold text-red-600">
                  {roomError}
                </p>
              )}

              <div className="sm:col-span-3 mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={roomLoading}
                  className="rounded-xl bg-[#173b31] px-8 py-3.5 font-bold text-white transition hover:bg-[#245a4b] disabled:opacity-60"
                >
                  {roomLoading ? "Đang tạo..." : "Lưu Hạng phòng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {pricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-5">
              <h2 className="text-2xl font-bold text-[#173b31]">
                Cập nhật Giá & Quỹ phòng
              </h2>
              <button
                onClick={() => setPricingModal(null)}
                className="grid size-10 place-items-center rounded-full bg-stone-100 font-bold hover:bg-stone-200"
              >
                ✕
              </button>
            </div>

            {pricingSuccess && (
              <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                {pricingSuccess}
              </div>
            )}

            <form
              onSubmit={handleUpdatePricing}
              className="mt-6 grid gap-5 sm:grid-cols-2"
            >
              <label className="sm:col-span-2 block text-sm font-bold text-stone-700">
                Chọn Hạng phòng muốn cập nhật
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <select
                      value={pricingForm.roomTypeId}
                      onChange={(e) =>
                        setPricingForm({
                          ...pricingForm,
                          roomTypeId: e.target.value,
                        })
                      }
                      className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 font-semibold text-stone-700 outline-none transition focus:border-[#173b31] focus:ring-1 focus:ring-[#173b31]"
                      required
                    >
                      {hotelRooms.map((room) => (
                        <option key={room._id} value={room._id}>
                          {room.isActive === false ? "[BẢO TRÌ] " : ""}
                          {room.title} (Giá: {room.basePrice.toLocaleString()}đ)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* NÚT BẬT/TẮT */}
                  <button
                    type="button"
                    onClick={handleToggleRoom}
                    className={`flex h-12 w-full sm:w-[160px] items-center justify-center gap-2 rounded-xl px-5 font-bold text-white shadow-sm transition ${
                      hotelRooms.find((r) => r._id === pricingForm.roomTypeId)
                        ?.isActive === false
                        ? "bg-emerald-600 hover:bg-emerald-700 hover:shadow-md"
                        : "bg-rose-600 hover:bg-rose-700 hover:shadow-md"
                    }`}
                  >
                    {hotelRooms.find((r) => r._id === pricingForm.roomTypeId)
                      ?.isActive === false ? (
                      <>
                        <i className="fa-solid fa-unlock-keyhole"></i> Mở bán
                        lại
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-lock"></i> Khóa bảo trì
                      </>
                    )}
                  </button>
                </div>
              </label>

              <label className="block text-sm font-bold text-stone-700">
                Áp dụng Từ ngày{" "}
                <input
                  type="date"
                  value={pricingForm.startDate}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      startDate: e.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                  required
                />
              </label>
              <label className="block text-sm font-bold text-stone-700">
                Đến hết ngày{" "}
                <input
                  type="date"
                  value={pricingForm.endDate}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, endDate: e.target.value })
                  }
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                  required
                />
              </label>

              <label className="block text-sm font-bold text-stone-700 text-[#b7812d]">
                Giá mới (VNĐ){" "}
                <input
                  type="number"
                  value={pricingForm.newPrice}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, newPrice: e.target.value })
                  }
                  placeholder="Bỏ trống nếu giữ nguyên"
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>
              <label className="block text-sm font-bold text-stone-700">
                Số phòng trống mới{" "}
                <input
                  type="number"
                  value={pricingForm.newQuantity}
                  onChange={(e) =>
                    setPricingForm({
                      ...pricingForm,
                      newQuantity: e.target.value,
                    })
                  }
                  placeholder="Bỏ trống nếu giữ nguyên"
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>

              {/* KHỐI KIỂM TRA QUỸ PHÒNG TRƯỚC KHI LƯU */}
              <div className="sm:col-span-2 mt-2 rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-stone-700">
                    Tình trạng quỹ phòng hiện tại
                  </p>
                  <button
                    type="button"
                    onClick={handleCheckInventory}
                    className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-[#b7812d] shadow-sm border border-stone-200 hover:bg-stone-100 transition"
                  >
                    <i className="fa-solid fa-magnifying-glass mr-1"></i> Kiểm
                    tra
                  </button>
                </div>

                {inventoryCheck && (
                  <div className="mt-4 max-h-40 overflow-y-auto rounded-xl bg-white border border-stone-200 p-2 text-sm shadow-inner">
                    {inventoryCheck.length === 0 ? (
                      <p className="text-stone-500 italic p-3 text-center">
                        Chưa có dữ liệu quỹ phòng trong giai đoạn này.
                      </p>
                    ) : (
                      inventoryCheck.map((inv) => (
                        <div
                          key={inv._id}
                          className="flex justify-between border-b border-stone-100 p-3 last:border-0 font-semibold text-stone-600"
                        >
                          <span>
                            <i className="fa-regular fa-calendar mr-2 text-stone-400"></i>
                            {new Date(inv.date).toLocaleDateString("vi-VN")}
                          </span>
                          <span>
                            Còn {inv.availableRooms} phòng{" "}
                            <span className="mx-2 text-stone-300">|</span>{" "}
                            <span className="text-[#b7812d]">
                              {inv.dynamicPrice.toLocaleString()}đ
                            </span>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 mt-2">
                <button
                  type="submit"
                  disabled={pricingLoading}
                  className="w-full rounded-xl bg-[#173b31] py-3.5 font-bold text-white transition hover:bg-[#245a4b] disabled:opacity-60"
                >
                  {pricingLoading ? "Đang xử lý..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
