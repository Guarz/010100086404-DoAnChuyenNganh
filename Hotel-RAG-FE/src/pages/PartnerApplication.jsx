// File: src/pages/PartnerDashboard.jsx
import { useState, useEffect } from "react";
import Icon from "../components/Icon";
import StatCard from "../components/StatCard";
import API from "../services/api";

const photos = {
  city: "https://images.unsplash.com/photo-1772006807170-5750a2aa3713?auto=format&fit=crop&w=900&q=85",
};

export default function PartnerDashboard() {
  const [submitted, setSubmitted] = useState(false);
  const [myHotels, setMyHotels] = useState([]);
  const [hotelsLoading, setHotelsLoading] = useState(true);

  // Các state quản lý Form Tạo Khách sạn
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const loadMyHotels = async () => {
    setHotelsLoading(true);
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

  useEffect(() => {
    // Bỏ qua cảnh báo ESLint cho hàm này vì đây là pattern lấy dữ liệu hợp lệ
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMyHotels();
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

        // Tải lại danh sách KS để KS mới vừa tạo hiện ra ngay lập tức
        loadMyHotels();
        setTimeout(() => setSubmitted(false), 5000);
      }
    } catch (error) {
      setCreateError(
        error.response?.data?.message ||
          "Không thể tạo khách sạn. Vui lòng kiểm tra lại thông tin.",
      );
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
              Chào buổi sáng, Đối tác.
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
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 transition-all">
            <Icon name="check" /> Hồ sơ chỗ nghỉ mới đã được gửi cho Quản trị
            viên xét duyệt.
          </div>
        )}

        {isCreating && (
          <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="font-display text-2xl font-semibold text-[#173b31]">
              Thông tin chỗ nghỉ mới
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Điền đầy đủ thông tin để hệ thống AI nhận diện tốt nhất.
            </p>

            <form
              onSubmit={handleCreateHotel}
              className="mt-6 grid gap-6 sm:grid-cols-2"
            >
              <label className="sm:col-span-2 block text-sm font-bold text-stone-700">
                Tên khách sạn / Resort *
                <input
                  name="hotelName"
                  value={formData.hotelName}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-[#173b31]"
                />
              </label>
              <label className="block text-sm font-bold text-stone-700">
                Tỉnh / Thành phố *
                <input
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-[#173b31]"
                />
              </label>
              <label className="block text-sm font-bold text-stone-700">
                Quận / Huyện *
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-[#173b31]"
                />
              </label>
              <label className="sm:col-span-2 block text-sm font-bold text-stone-700">
                Địa chỉ cụ thể (Số nhà, Tên đường) *
                <input
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  required
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-[#173b31]"
                />
              </label>
              <label className="sm:col-span-2 block text-sm font-bold text-stone-700">
                Mô tả chỗ nghỉ
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-[#173b31]"
                />
              </label>
              <label className="sm:col-span-2 block text-sm font-bold text-stone-700">
                Tiện ích chung (Ngăn cách bởi dấu phẩy)
                <input
                  name="amenities"
                  value={formData.amenities}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-[#173b31]"
                />
              </label>
              <label className="sm:col-span-2 block text-sm font-bold text-stone-700">
                Link Hình ảnh (Mỗi link ảnh trên 1 dòng)
                <textarea
                  name="images"
                  value={formData.images}
                  onChange={handleChange}
                  rows="3"
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 outline-none focus:border-[#173b31] font-mono text-xs text-stone-600"
                />
              </label>

              {createError && (
                <p className="sm:col-span-2 text-sm font-bold text-red-600">
                  {createError}
                </p>
              )}
              <div className="sm:col-span-2 flex justify-end gap-3 mt-2 border-t border-stone-100 pt-6">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="rounded-xl px-6 py-3 font-bold text-stone-500 hover:bg-stone-100"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="rounded-xl bg-[#173b31] px-6 py-3 font-bold text-white transition hover:bg-[#245a4b] disabled:opacity-60"
                >
                  {createLoading ? "Đang gửi hồ sơ..." : "Gửi yêu cầu duyệt"}
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
            note="Chưa có lượt đánh giá"
          />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold text-[#173b31]">
                  Chỗ nghỉ của bạn
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  Quản lý trạng thái và hiệu suất
                </p>
              </div>
              <button className="text-sm font-bold text-[#173b31]">
                Xem tất cả ({myHotels.length})
              </button>
            </div>

            {/* DỮ LIỆU THẬT ĐƯỢC MAP Ở ĐÂY */}
            {hotelsLoading ? (
              <div className="mt-8 text-center text-sm text-stone-500">
                Đang tải danh sách chỗ nghỉ...
              </div>
            ) : myHotels.length === 0 ? (
              <div className="mt-8 text-center text-sm text-stone-500">
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
                        className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${
                          hotel.status === "Approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : hotel.status === "Rejected"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
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
                    <p className="mt-3 text-xs font-semibold text-stone-400">
                      Cập nhật:{" "}
                      {new Date(
                        hotel.updatedAt || hotel.createdAt,
                      ).toLocaleDateString("vi-VN")}
                    </p>
                  </div>

                  {hotel.status === "Approved" && (
                    <button className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold transition hover:bg-stone-50">
                      Quản lý phòng
                    </button>
                  )}
                </div>
              ))
            )}
          </section>

          <aside className="h-fit rounded-2xl bg-[#173b31] p-7 text-white shadow-sm">
            <span className="grid size-11 place-items-center rounded-full bg-white/10 text-[#f2cc88]">
              <Icon name="sparkle" />
            </span>
            <h2 className="font-display mt-6 text-2xl font-semibold">
              Mẹo tăng hiển thị
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/65">
              Hoàn thiện đủ tiện nghi và thêm ảnh chất lượng cao để xuất hiện
              nhiều hơn trong kết quả tìm kiếm của khách hàng.
            </p>
            <button className="mt-8 w-full rounded-full bg-white py-3 text-sm font-bold text-[#173b31] transition hover:bg-stone-100">
              Tìm hiểu thêm
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}
