// File: src/pages/HotelDetail.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom"; // Thêm useParams
import Icon from "../components/Icon"; // Chỉnh lại đường dẫn cho đúng nha
import API from "../services/api";

const photos = {
  hero: "https://images.unsplash.com/photo-1615722440048-da4ccf6de048?auto=format&fit=crop&w=1800&q=88",
};

export default function HotelDetail() {
  const navigate = useNavigate();
  const { id } = useParams(); // LẤY ID TỪ URL
  const [rooms, setRooms] = useState([]); // STATE LƯU HẠNG PHÒNG
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);

  // GỌI API KHI MỞ TRANG
  useEffect(() => {
    const fetchHotelDetail = async () => {
      try {
        const response = await API.get(`/hotels/${id}`);
        if (response.data.success) {
          setHotel(response.data.data);
        }
      } catch (error) {
        console.error("Lỗi lấy chi tiết khách sạn:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHotelDetail();
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Chạy song song 2 request cho nhanh
        const [hotelRes, roomsRes] = await Promise.all([
          API.get(`/hotels/${id}`),
          API.get(`/hotels/${id}/rooms`),
        ]);

        if (hotelRes.data.success) setHotel(hotelRes.data.data);
        if (roomsRes.data.success) setRooms(roomsRes.data.data);
      } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center font-bold text-[#173b31]">
        Đang tải dữ liệu khách sạn...
      </div>
    );
  }

  if (!hotel) {
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
  }

  return (
    <main className="bg-[#fffdf9]">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-8 lg:px-8">
        <button
          onClick={() => navigate("/hotels")}
          className="mb-7 flex items-center gap-2 text-sm font-bold text-stone-500 transition hover:text-[#173b31]"
        >
          ← Quay lại kết quả tìm kiếm
        </button>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#d09b42]">
              {/* Tạm thời hiển thị 5 sao cứng */}
              ★★★★★ <span className="text-stone-400">Nestly Tuyển chọn</span>
            </div>
            <h1 className="font-display mt-2 text-4xl font-semibold text-[#173b31] sm:text-5xl">
              {hotel.hotelName}
            </h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-stone-500">
              <Icon name="location" size={16} /> {hotel.address?.street},{" "}
              {hotel.address?.city}, {hotel.address?.province}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold transition hover:bg-stone-50">
              Chia sẻ
            </button>
            <button className="flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm font-bold transition hover:bg-stone-50">
              <Icon name="heart" size={16} /> Lưu
            </button>
          </div>
        </div>

        {/* BỘ SƯU TẬP ẢNH THẬT TỪ DATABASE */}
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
          <div>
            <div className="flex items-start justify-between border-b border-stone-200 pb-8">
              <div>
                <h2 className="font-display text-3xl font-semibold text-[#173b31]">
                  Giới thiệu về chỗ nghỉ
                </h2>
              </div>
              <span className="grid size-12 place-items-center rounded-full bg-[#e8f2ed] text-[#173b31]">
                <Icon name="sparkle" />
              </span>
            </div>

            {/* MÔ TẢ TỪ DATABASE */}
            <p className="border-b border-stone-200 py-8 leading-8 text-stone-600 whitespace-pre-line">
              {hotel.description}
            </p>

            {/* TIỆN ÍCH TỪ DATABASE */}
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

            <div className="py-8">
              <h2 className="font-display text-2xl font-semibold text-[#173b31]">
                Đánh giá từ khách
              </h2>
              <div className="mt-5 flex items-center gap-4">
                <span className="grid size-14 place-items-center rounded-xl bg-[#173b31] font-display text-xl text-white">
                  {hotel.rating || "4.5"}
                </span>
                <div>
                  <p className="font-bold">Tuyệt vời</p>
                  <p className="mt-1 text-sm text-stone-500">
                    Dựa trên dữ liệu hệ thống
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card Đặt phòng (Sau này sẽ nối API RoomType) */}
          {/* CARD CHỌN PHÒNG */}
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
                  <div className="flex flex-col sm:flex-row gap-5">
                    {/* Ảnh phòng (nếu có) */}
                    <div className="sm:w-1/3 aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 shrink-0">
                      <img
                        src={
                          room.images?.[0] ||
                          "https://images.unsplash.com/photo-1569335468885-d7d1a41e570c?w=600"
                        }
                        alt={room.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Thông tin phòng */}
                    <div className="flex flex-col justify-between flex-1">
                      <div>
                        <h3 className="text-xl font-bold text-[#173b31]">
                          {room.title}
                        </h3>
                        <p className="text-sm text-stone-500 mt-1">
                          {room.description}
                        </p>

                        {/* Tiện ích phòng */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="text-xs font-semibold bg-stone-100 px-2 py-1 rounded">
                            <Icon
                              name="users"
                              size={12}
                              className="inline mr-1"
                            />
                            Tối đa {room.maxAdults} người lớn,{" "}
                            {room.maxChildren} trẻ em
                          </span>
                          {room.amenities?.slice(0, 3).map((amenity, idx) => (
                            <span
                              key={idx}
                              className="text-xs font-semibold bg-stone-100 px-2 py-1 rounded text-stone-600"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Giá và Nút Đặt */}
                      <div className="flex flex-wrap items-end justify-between mt-5 pt-5 border-t border-stone-100 gap-4">
                        <div>
                          <p className="text-xs text-stone-400">
                            Giá phòng mỗi đêm
                          </p>
                          <p>
                            <strong className="text-2xl text-[#b7812d]">
                              {room.basePrice?.toLocaleString("vi-VN")}₫
                            </strong>
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            alert(
                              `Chức năng Đặt phòng ${room.title} đang được phát triển!`,
                            );
                          }}
                          className="rounded-xl bg-[#173b31] px-6 py-3 font-bold text-white transition hover:bg-[#245a4b]"
                        >
                          Chọn phòng này
                        </button>
                      </div>
                    </div>
                  </div>
                </aside>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
