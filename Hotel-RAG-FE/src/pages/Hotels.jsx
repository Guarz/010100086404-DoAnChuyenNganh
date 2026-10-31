// File: src/pages/Hotels.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Icon from "../components/Icon";
import API from "../services/api";

// Hàm tiện ích lấy ngày mặc định
const getFormattedDate = (addDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + addDays);
  return date.toISOString().split("T")[0];
};

export default function Hotels() {
  const navigate = useNavigate();
  const location = useLocation();

  const [allHotels, setAllHotels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lấy params ban đầu từ URL
  const queryParams = new URLSearchParams(location.search);

  // === 1. STATE QUẢN LÝ THANH TÌM KIẾM TRỰC TIẾP ===
  const [showGuestMenu, setShowGuestMenu] = useState(false);
  const [searchData, setSearchData] = useState({
    city: queryParams.get("city") || "",
    checkIn: queryParams.get("checkIn") || getFormattedDate(0),
    checkOut: queryParams.get("checkOut") || getFormattedDate(1),
    adults: parseInt(queryParams.get("adults")) || 2,
    children: parseInt(queryParams.get("children")) || 0,
    rooms: parseInt(queryParams.get("rooms")) || 1,
  });

  // Bộ lọc tiện nghi: lấy danh mục chuẩn từ API, lựa chọn lưu trên URL (?amenities=Hồ bơi,Spa)
  const [facets, setFacets] = useState([]);
  const [showFilters, setShowFilters] = useState(false); // chỉ dùng trên điện thoại
  const selectedAmenities = (queryParams.get("amenities") || "").split(",").filter(Boolean);
  const [sort, setSort] = useState("Đề xuất");

  // === 2. CÁC HÀM XỬ LÝ TÌM KIẾM ===
  const updateGuest = (field, operation) => {
    setSearchData((prev) => {
      let newValue = prev[field] + operation;
      if (field === "adults" && newValue < 1) newValue = 1;
      if (field === "children" && newValue < 0) newValue = 0;
      if (field === "rooms" && newValue < 1) newValue = 1;
      return { ...prev, [field]: newValue };
    });
  };

  const handleSearchSubmit = () => {
    // Đóng menu nếu đang mở
    setShowGuestMenu(false);
    // Thay đổi URL để kích hoạt useEffect bên dưới (không reload trang), giữ nguyên bộ lọc tiện nghi
    const params = new URLSearchParams(searchData);
    if (selectedAmenities.length) params.set("amenities", selectedAmenities.join(","));
    navigate(`/hotels?${params.toString()}`);
  };

  // Bật/tắt 1 tiện nghi -> cập nhật URL -> useEffect gọi lại API
  const setAmenities = (list) => {
    const params = new URLSearchParams(location.search);
    if (list.length) params.set("amenities", list.join(","));
    else params.delete("amenities");
    navigate(`/hotels?${params.toString()}`, { replace: true });
  };
  const toggleAmenity = (label) =>
    setAmenities(
      selectedAmenities.includes(label)
        ? selectedAmenities.filter((a) => a !== label)
        : [...selectedAmenities, label],
    );

  useEffect(() => {
    API.get("/hotels/amenities")
      .then((res) => setFacets(res.data.data))
      .catch((err) => console.error("Lỗi tải danh mục tiện nghi:", err));
  }, []);

  // === 3. GỌI API KHI URL THAY ĐỔI ===
  useEffect(() => {
    const fetchSearchedHotels = async () => {
      setLoading(true);
      try {
        // Luôn dùng API tìm kiếm: hỗ trợ lọc tiện nghi và trả về giá thấp nhất mỗi khách sạn
        const response = await API.get(`/hotels/search${location.search}`);
        if (response.data.success) {
          setAllHotels(response.data.data);
        }
      } catch (error) {
        console.error("Lỗi lấy dữ liệu khách sạn:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSearchedHotels();
  }, [location.search]); // Hook này chạy lại mỗi khi bấm "Cập nhật" đổi URL

  // === 4. SẮP XẾP (lọc tiện nghi đã làm ở server) ===
  const sorted = [...allHotels].sort((a, b) => {
    if (sort === "Đánh giá cao") return (b.rating || 0) - (a.rating || 0);
    if (sort === "Giá thấp nhất") return (a.priceFrom || 0) - (b.priceFrom || 0);
    if (sort === "Giá cao nhất") return (b.priceFrom || 0) - (a.priceFrom || 0);
    return 0;
  });

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      {/* THANH TÌM KIẾM TRỰC TIẾP TRÊN TRANG HOTELS */}
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-5 sm:py-6 lg:px-8">
          <div className="relative grid gap-3 rounded-2xl border border-stone-200 p-3 shadow-sm md:grid-cols-2 lg:grid-cols-[1.5fr_2fr_1.5fr_auto]">
            {/* Điểm đến */}
            <label className="rounded-xl bg-stone-50 px-4 py-2 hover:bg-stone-100 cursor-text flex flex-col justify-center">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400">
                Điểm đến
              </span>
              <input
                type="text"
                value={searchData.city}
                onChange={(e) =>
                  setSearchData({ ...searchData, city: e.target.value })
                }
                className="mt-1 w-full bg-transparent font-bold text-stone-800 outline-none placeholder-stone-300"
                placeholder="Tất cả địa điểm"
              />
            </label>

            {/* Ngày lưu trú */}
            <div className="rounded-xl bg-stone-50 px-4 py-2 hover:bg-stone-100 flex flex-col justify-center">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400">
                Nhận phòng — Trả phòng
              </span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="date"
                  value={searchData.checkIn}
                  onChange={(e) =>
                    setSearchData({ ...searchData, checkIn: e.target.value })
                  }
                  className="w-full bg-transparent font-bold text-stone-800 outline-none text-sm cursor-pointer"
                />
                <span className="text-stone-300">-</span>
                <input
                  type="date"
                  value={searchData.checkOut}
                  onChange={(e) =>
                    setSearchData({ ...searchData, checkOut: e.target.value })
                  }
                  className="w-full bg-transparent font-bold text-stone-800 outline-none text-sm cursor-pointer"
                />
              </div>
            </div>

            {/* Khách & phòng */}
            <div className="relative">
              <button
                onClick={() => setShowGuestMenu(!showGuestMenu)}
                className="w-full h-full text-left rounded-xl bg-stone-50 px-4 py-2 hover:bg-stone-100 flex flex-col justify-center"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400">
                  Khách & phòng
                </span>
                <span className="mt-1 font-bold text-sm text-stone-800">
                  {searchData.adults} người lớn
                  {searchData.children > 0
                    ? `, ${searchData.children} trẻ em`
                    : ""}{" "}
                  · {searchData.rooms} phòng
                </span>
              </button>

              {/* MENU DROP-DOWN CHỌN KHÁCH & PHÒNG (GIAO DIỆN MỚI) */}
              {showGuestMenu && (
                <div className="absolute left-0 top-[110%] z-50 w-full min-w-[17rem] rounded-lg border border-slate-200 bg-white p-5 shadow-xl sm:w-80">
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
                        <Icon name="users" size={18} />
                      </span>
                      <span className="font-semibold text-slate-800">
                        Trẻ em
                      </span>
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
                      <span className="font-semibold text-slate-800">
                        Phòng
                      </span>
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

            {/* Nút Submit */}
            <button
              onClick={handleSearchSubmit}
              className="flex h-full items-center justify-center gap-2 rounded-xl bg-[#173b31] px-7 py-3 font-bold text-white transition hover:bg-[#245a4b]"
            >
              <Icon name="search" /> Cập nhật
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[#b7812d]">
              Kết quả tìm kiếm
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold text-[#173b31] sm:text-4xl">
              {loading
                ? "Đang tìm kiếm..."
                : `${sorted.length} chỗ nghỉ phù hợp`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className="rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold lg:hidden"
            >
              Bộ lọc{selectedAmenities.length ? ` (${selectedAmenities.length})` : ""}
            </button>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <span className="hidden sm:inline">Sắp xếp</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sắp xếp"
                className="rounded-full border border-stone-200 bg-white px-4 py-2.5 font-bold outline-none"
              >
                <option>Đề xuất</option>
                <option>Đánh giá cao</option>
                <option>Giá thấp nhất</option>
                <option>Giá cao nhất</option>
              </select>
            </label>
          </div>
        </div>

        {selectedAmenities.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {selectedAmenities.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleAmenity(label)}
                className="rounded-full bg-[#173b31] px-3 py-1.5 text-xs font-bold text-white"
                aria-label={`Bỏ lọc ${label}`}
              >
                {label} ✕
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:mt-9 lg:grid-cols-[260px_1fr] lg:gap-9">
          <aside
            className={`h-fit rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 lg:sticky lg:top-28 lg:block ${showFilters ? "block" : "hidden"}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-[#173b31]">
                Tiện nghi
              </h2>
              {selectedAmenities.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAmenities([])}
                  className="text-xs font-bold text-[#b7812d]"
                >
                  Bỏ chọn ({selectedAmenities.length})
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-stone-400">
              Khách sạn phải có đủ tất cả tiện nghi đã chọn
            </p>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-stone-100 pt-4 sm:grid-cols-3 lg:grid-cols-1">
              {facets.length === 0 && (
                <p className="text-sm text-stone-400">Đang tải...</p>
              )}
              {facets.map((facet) => (
                <label
                  key={facet.label}
                  className="flex cursor-pointer items-center gap-2.5 text-sm text-stone-600"
                >
                  <input
                    type="checkbox"
                    checked={selectedAmenities.includes(facet.label)}
                    onChange={() => toggleAmenity(facet.label)}
                    className="size-4 shrink-0 accent-[#173b31]"
                  />
                  <span className="min-w-0 flex-1 truncate">{facet.label}</span>
                  <span className="text-xs text-stone-400">{facet.count}</span>
                </label>
              ))}
            </div>
          </aside>

          <section className="grid gap-6 sm:grid-cols-2">
            {loading ? (
              <div className="col-span-full py-20 text-center font-bold text-[#173b31]">
                Đang tải dữ liệu...
              </div>
            ) : sorted.length === 0 ? (
              <div className="col-span-full rounded-2xl bg-white p-8 text-center shadow-sm sm:p-16">
                <h3 className="font-display text-2xl text-[#173b31]">
                  Chưa tìm thấy chỗ nghỉ phù hợp
                </h3>
                <p className="mt-2 text-sm text-stone-500">
                  Thử thay đổi điểm đến, ngày nhận phòng hoặc bỏ bớt tiện nghi.
                </p>
              </div>
            ) : (
              sorted.map((hotel) => (
                <article
                  key={hotel._id}
                  className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <button
                    onClick={() => navigate(`/hotels/${hotel._id}${location.search}`)}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img
                        src={
                          hotel.images?.[0] ||
                          "https://images.unsplash.com/photo-1569335468885-d7d1a41e570c?w=800"
                        }
                        alt={hotel.hotelName}
                        className="size-full object-cover"
                      />
                      <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold">
                        Nestly Lựa chọn
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-display text-xl font-semibold text-[#173b31]">
                            {hotel.hotelName}
                          </h3>
                          <p className="mt-1 truncate text-sm text-stone-500">
                            {[hotel.address?.street, hotel.address?.city].filter(Boolean).join(", ")}
                          </p>
                        </div>
                        {hotel.reviewCount > 0 ? (
                          <span className="flex shrink-0 items-center gap-1 text-sm font-bold">
                            <span className="text-[#d09b42]">★</span>
                            {hotel.rating.toFixed(1)}
                            <span className="text-xs font-semibold text-stone-400">({hotel.reviewCount})</span>
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-semibold text-stone-400">Mới</span>
                        )}
                      </div>
                      {hotel.amenities?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {hotel.amenities.slice(0, 3).map((a) => (
                            <span key={a} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                              {a}
                            </span>
                          ))}
                          {hotel.amenities.length > 3 && (
                            <span className="text-[11px] font-semibold text-stone-400">+{hotel.amenities.length - 3}</span>
                          )}
                        </div>
                      )}
                      <div className="mt-4 flex items-end justify-between border-t border-stone-100 pt-4">
                        <p className="text-xs text-stone-400">
                          {hotel.roomTypes?.length ? `${hotel.roomTypes.length} hạng phòng phù hợp` : "Xem phòng trống"}
                        </p>
                        {hotel.priceFrom ? (
                          <p className="text-right">
                            <span className="block text-[11px] text-stone-400">Từ</span>
                            <strong className="text-lg text-[#173b31]">
                              {hotel.priceFrom.toLocaleString("vi-VN")}₫
                            </strong>
                            <span className="text-xs text-stone-400">/đêm</span>
                          </p>
                        ) : (
                          <strong className="text-lg text-[#173b31]">Xem chi tiết</strong>
                        )}
                      </div>
                    </div>
                  </button>
                </article>
              ))
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
