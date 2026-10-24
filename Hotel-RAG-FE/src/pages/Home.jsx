import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import API from "../services/api";

const photos = {
  hero: "https://images.unsplash.com/photo-1615722440048-da4ccf6de048?auto=format&fit=crop&w=1800&q=88",
};

// Hàm tiện ích để lấy ngày định dạng YYYY-MM-DD
const getFormattedDate = (addDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + addDays);
  return date.toISOString().split("T")[0];
};

export default function Home() {
  const navigate = useNavigate();
  const [featuredHotels, setFeaturedHotels] = useState([]);
  const [loading, setLoading] = useState(true);

  // === STATE QUẢN LÝ THANH TÌM KIẾM ===
  const [showGuestMenu, setShowGuestMenu] = useState(false);
  const [searchData, setSearchData] = useState({
    city: "",
    checkIn: getFormattedDate(0), // Hôm nay
    checkOut: getFormattedDate(1), // Ngày mai
    adults: 2,
    children: 0,
    rooms: 1,
  });

  // Hàm tăng giảm khách/phòng
  const updateGuest = (field, operation) => {
    setSearchData((prev) => {
      let newValue = prev[field] + operation;
      if (field === "adults" && newValue < 1) newValue = 1;
      if (field === "children" && newValue < 0) newValue = 0;
      if (field === "rooms" && newValue < 1) newValue = 1;
      return { ...prev, [field]: newValue };
    });
  };

  // Hàm xử lý khi bấm nút "Tìm kiếm"
  const handleSearchSubmit = () => {
    // Gom dữ liệu thành URL Query Parameters (?city=...&checkIn=...)
    const params = new URLSearchParams(searchData).toString();
    // Chuyển hướng sang trang Danh sách Khách sạn kèm tham số lọc
    navigate(`/hotels?${params}`);
  };
  // =====================================

  useEffect(() => {
    const fetchPublicHotels = async () => {
      try {
        const response = await API.get("/hotels");
        if (response.data.success) {
          setFeaturedHotels(response.data.data);
        }
      } catch (error) {
        console.error("Lỗi tải khách sạn trang chủ:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicHotels();
  }, []);

  return (
    <main>
      <section className="relative mx-auto mt-4 min-h-[680px] max-w-[1500px] rounded-[2rem] bg-[#173b31] sm:mx-4 lg:mx-auto">
        <img
          src={photos.hero}
          alt="Khu nghỉ dưỡng"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102f28]/90 via-[#102f28]/55 to-transparent" />

        <div className="relative mx-auto flex min-h-[680px] max-w-7xl flex-col justify-center px-6 pb-32 pt-20 lg:px-8">
          <div className="mb-6 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md">
            <Icon name="sparkle" size={16} /> Hơn 12.000 chỗ nghỉ đã được tuyển
            chọn
          </div>
          <h1 className="font-display max-w-3xl text-5xl leading-[1.05] font-medium tracking-tight text-white sm:text-7xl">
            Đi đâu cũng được.
            <br />
            <span className="italic text-[#f2cc88]">
              Miễn là thật đáng nhớ.
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-white/80">
            Từ homestay ấm cúng đến những khu nghỉ dưỡng bên biển — tìm một nơi
            dành riêng cho chuyến đi của bạn.
          </p>
        </div>

        {/* THANH TÌM KIẾM THỦ CÔNG */}
        {/* THANH TÌM KIẾM ĐỘNG */}
        <div className="absolute inset-x-4 bottom-5 mx-auto max-w-[1200px] rounded-2xl bg-white p-3 shadow-2xl sm:inset-x-8 lg:flex lg:items-center">
          {/* 1. Ô ĐIỂM ĐẾN */}
          <label className="flex flex-1 items-center gap-4 rounded-xl px-4 py-3 hover:bg-stone-50 cursor-text">
            <span className="text-[#b7812d]">
              <Icon name="location" size={22} />
            </span>
            <span className="flex-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-stone-400">
                Điểm đến
              </span>
              <input
                type="text"
                value={searchData.city}
                onChange={(e) =>
                  setSearchData({ ...searchData, city: e.target.value })
                }
                className="mt-1 w-full bg-transparent font-semibold text-stone-800 outline-none placeholder-stone-300"
                placeholder="Bạn muốn đi đâu?"
              />
            </span>
          </label>

          <div className="hidden h-10 w-px bg-stone-200 lg:block" />

          {/* 2. Ô CHỌN NGÀY */}
          <div className="flex flex-1 items-center gap-2 rounded-xl px-4 py-3 hover:bg-stone-50">
            <span className="text-[#b7812d]">
              <Icon name="calendar" size={22} />
            </span>
            <div className="flex flex-1 items-center gap-3">
              <label className="flex-1 cursor-pointer">
                <span className="block text-xs font-bold uppercase tracking-wider text-stone-400">
                  Nhận phòng
                </span>
                <input
                  type="date"
                  value={searchData.checkIn}
                  onChange={(e) =>
                    setSearchData({ ...searchData, checkIn: e.target.value })
                  }
                  className="mt-1 w-full bg-transparent font-semibold text-stone-800 outline-none text-sm cursor-pointer"
                />
              </label>
              <span className="text-stone-300">-</span>
              <label className="flex-1 cursor-pointer">
                <span className="block text-xs font-bold uppercase tracking-wider text-stone-400">
                  Trả phòng
                </span>
                <input
                  type="date"
                  value={searchData.checkOut}
                  onChange={(e) =>
                    setSearchData({ ...searchData, checkOut: e.target.value })
                  }
                  className="mt-1 w-full bg-transparent font-semibold text-stone-800 outline-none text-sm cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div className="hidden h-10 w-px bg-stone-200 lg:block" />

          {/* 3. Ô CHỌN KHÁCH VÀ PHÒNG */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowGuestMenu(!showGuestMenu)}
              className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left hover:bg-stone-50"
            >
              <span className="text-[#b7812d]">
                <Icon name="users" size={22} />
              </span>
              <span>
                <span className="block text-xs font-bold uppercase tracking-wider text-stone-400">
                  Khách & phòng
                </span>
                <span className="mt-1 block font-semibold">
                  {searchData.adults} người lớn
                  {searchData.children > 0
                    ? `, ${searchData.children} trẻ em`
                    : ""}{" "}
                  · {searchData.rooms} phòng
                </span>
              </span>
            </button>

            {/* MENU DROP-DOWN CHỌN KHÁCH & PHÒNG (GIAO DIỆN MỚI) */}
            {showGuestMenu && (
              <div className="absolute top-[110%] right-0 z-50 w-80 rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
                {/* Người lớn */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[#0071c2]">
                      <Icon name="users" size={22} />
                    </span>
                    <span className="font-semibold text-slate-800">
                      Người lớn
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        updateGuest("adults", -1);
                      }}
                      className="flex size-9 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xl font-bold text-[#0071c2] transition hover:bg-slate-100"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-semibold text-slate-800">
                      {searchData.adults}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        updateGuest("adults", 1);
                      }}
                      className="flex size-9 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xl font-bold text-[#0071c2] transition hover:bg-slate-100"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Trẻ em */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[#0071c2]">
                      <Icon name="user" size={22} />
                    </span>
                    <span className="font-semibold text-slate-800">Trẻ em</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        updateGuest("children", -1);
                      }}
                      className="flex size-9 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xl font-bold text-[#0071c2] transition hover:bg-slate-100"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-semibold text-slate-800">
                      {searchData.children}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        updateGuest("children", 1);
                      }}
                      className="flex size-9 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xl font-bold text-[#0071c2] transition hover:bg-slate-100"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Phòng */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[#0071c2]">
                      <Icon name="bed" size={22} />
                    </span>
                    <span className="font-semibold text-slate-800">Phòng</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        updateGuest("rooms", -1);
                      }}
                      className="flex size-9 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xl font-bold text-[#0071c2] transition hover:bg-slate-100"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-semibold text-slate-800">
                      {searchData.rooms}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        updateGuest("rooms", 1);
                      }}
                      className="flex size-9 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xl font-bold text-[#0071c2] transition hover:bg-slate-100"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Nút Xong (Done) */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowGuestMenu(false);
                    }}
                    className="rounded bg-[#0071c2] px-6 py-2.5 font-bold text-white transition hover:bg-[#005999]"
                  >
                    Xong
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. NÚT SUBMIT */}
          <button
            onClick={handleSearchSubmit}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d09b42] px-7 py-4 font-bold text-white transition hover:bg-[#b7812d] lg:mt-0 lg:w-auto lg:py-5"
          >
            <Icon name="search" size={19} /> Tìm kiếm
          </button>
        </div>
      </section>

      {/* DANH SÁCH KHÁCH SẠN NỔI BẬT TỪ DATABASE */}
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <h2 className="font-display text-3xl font-semibold text-[#173b31]">
          Điểm đến nổi bật
        </h2>
        <p className="mt-2 text-stone-500">
          Các chỗ nghỉ được yêu thích nhất trên Nestly.
        </p>

        {loading ? (
          <p className="mt-10 text-center font-bold text-stone-500">
            Đang tải danh sách khách sạn...
          </p>
        ) : featuredHotels.length === 0 ? (
          <p className="mt-10 text-center font-bold text-stone-500">
            Hiện chưa có khách sạn nào hoạt động.
          </p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredHotels.map((hotel) => (
              <div
                key={hotel._id}
                onClick={() => navigate(`/hotels/${hotel._id}`)}
                className="group cursor-pointer rounded-2xl border border-stone-200 bg-white p-3 shadow-sm transition hover:shadow-lg"
              >
                <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-stone-100 relative">
                  <img
                    src={
                      hotel.images?.[0] ||
                      "https://images.unsplash.com/photo-1569335468885-d7d1a41e570c?w=600"
                    }
                    alt={hotel.hotelName}
                    className="size-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  {/* Badge Đánh giá */}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur rounded-lg px-2 py-1 text-xs font-extrabold text-[#173b31] shadow">
                    ★ {hotel.rating > 0 ? hotel.rating : "Mới"}
                  </div>
                </div>

                <div className="mt-4 px-1">
                  <h3 className="truncate text-lg font-bold text-[#173b31]">
                    {hotel.hotelName}
                  </h3>
                  <p className="truncate text-sm text-stone-500">
                    {hotel.address?.city}, {hotel.address?.province}
                  </p>

                  <div className="mt-3 flex items-end justify-between">
                    <p className="text-xs text-stone-400">Trạng thái</p>
                    <p className="font-extrabold text-[#b7812d]">
                      Xem chi tiết
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Phần Partner (Giữ nguyên) */}
      <section className="bg-[#f1eee6] py-24 mt-12">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 lg:grid-cols-2 lg:px-8">
          <div>
            <span className="grid size-12 place-items-center rounded-full bg-[#e2b765] text-white">
              <Icon name="home" size={23} />
            </span>
            <h2 className="font-display mt-7 text-4xl font-semibold leading-tight text-[#173b31] sm:text-5xl">
              Biến chỗ trống thành
              <br />
              <span className="italic">nguồn thu mới.</span>
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-stone-600">
              Đăng khách sạn, villa hoặc homestay của bạn. Nestly đồng hành từ
              bước thiết lập đầu tiên đến khi đón những vị khách đầu tiên.
            </p>
            <button
              onClick={() => navigate("/partner-apply")}
              className="mt-8 flex items-center gap-2 rounded-full bg-[#173b31] px-6 py-3.5 font-bold text-white transition hover:bg-[#245a4b]"
            >
              Trở thành đối tác <Icon name="arrow" size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="font-display text-4xl font-semibold text-[#173b31]">
                18%
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Thu nhập trung bình tăng sau 3 tháng
              </p>
            </div>
            <div className="mt-8 rounded-2xl bg-[#173b31] p-6 text-white">
              <Icon name="shield" />
              <p className="mt-8 font-semibold">Thanh toán an toàn</p>
              <p className="mt-2 text-sm text-white/60">
                Được bảo vệ trên mọi giao dịch
              </p>
            </div>
            <div className="-mt-4 rounded-2xl bg-[#d4a34f] p-6 text-white">
              <Icon name="users" />
              <p className="mt-8 font-semibold">12.000+ đối tác</p>
            </div>
            <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
              <p className="font-display text-4xl font-semibold text-[#173b31]">
                24/7
              </p>
              <p className="mt-2 text-sm text-stone-500">
                Đội ngũ hỗ trợ riêng
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
