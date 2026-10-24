import { useState, useEffect } from "react";
import StatCard from "../components/StatCard";
import API from "../services/api";

const photos = {
  city: "https://images.unsplash.com/photo-1772006807170-5750a2aa3713?auto=format&fit=crop&w=900&q=85",
};

export default function PartnerDashboard() {
  const [submitted, setSubmitted] = useState(false);
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
        amenities: roomFormData.amenities
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean),
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
  // ====================================

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
        amenities: formData.amenities
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean),
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

        setMyHotels((prev) => [response.data.data, ...prev]);

        setTimeout(() => setSubmitted(false), 5000);
      }
    } catch (error) {
      setCreateError(error.response?.data?.message || "Lỗi tạo khách sạn.");
    } finally {
      setCreateLoading(false);
    }
  };

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
                Tiện ích (cách nhau dấu phẩy){" "}
                <input
                  name="amenities"
                  value={formData.amenities}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>
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
            value="0"
            note="Chưa có dữ liệu"
          />
          <StatCard
            icon="wallet"
            label="Doanh thu dự kiến"
            value="0₫"
            note="Chưa có dữ liệu"
          />
          <StatCard
            icon="bed"
            label="Tỷ lệ lấp đầy"
            value="0%"
            note="Chưa có dữ liệu"
          />
          <StatCard
            icon="star"
            label="Điểm đánh giá"
            value="0.0"
            note="Chưa có đánh giá"
          />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold text-[#173b31]">
                  Chỗ nghỉ của bạn
                </h2>
              </div>
            </div>

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
                  className="mt-6 flex flex-col gap-5 border-t border-stone-100 pt-6 sm:flex-row sm:items-center"
                >
                  <img
                    src={hotel.images?.[0] || photos.city}
                    className="h-28 w-full rounded-xl object-cover sm:w-40 bg-stone-100"
                    alt={hotel.hotelName}
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-stone-900">
                        {hotel.hotelName}
                      </h3>
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
                  </div>
                  {hotel.status === "Approved" && (
                    <button
                      onClick={() => setManagingHotel(hotel)}
                      className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold transition hover:bg-stone-50"
                    >
                      Quản lý phòng
                    </button>
                  )}
                </div>
              ))
            )}
          </section>
        </div>
      </div>

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

              <label className="sm:col-span-3 block text-sm font-bold text-stone-700">
                Tiện ích phòng (Cách nhau dấu phẩy){" "}
                <input
                  name="amenities"
                  value={roomFormData.amenities}
                  onChange={handleRoomChange}
                  placeholder="Ban công, Bồn tắm, Tivi 65 inch"
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3"
                />
              </label>

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
    </main>
  );
}
