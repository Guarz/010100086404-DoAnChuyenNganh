// File: src/pages/AdminDashboard.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon"; // Hoặc "../components/Icon"
import StatCard from "../components/StatCard";
import API from "../services/api";

const HOTEL_FILTERS = [
  { value: "Pending", label: "Chờ duyệt" },
  { value: "Approved", label: "Đã duyệt" },
  { value: "Rejected", label: "Từ chối" },
  { value: "all", label: "Tất cả" },
];

const HOTEL_STATUS_BADGE = {
  Pending: { label: "CHỜ DUYỆT", className: "bg-amber-50 text-amber-700" },
  Approved: { label: "ĐÃ DUYỆT", className: "bg-emerald-50 text-emerald-700" },
  Rejected: { label: "ĐÃ TỪ CHỐI", className: "bg-red-50 text-red-700" },
};

export default function AdminDashboard() {
  const [items, setItems] = useState([]); // Danh sách khách sạn theo bộ lọc
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [hotelFilter, setHotelFilter] = useState("Pending");
  const [hotelSummary, setHotelSummary] = useState({
    Pending: 0,
    Approved: 0,
    Rejected: 0,
    all: 0,
  });
  const [decidingHotelId, setDecidingHotelId] = useState("");
  const [expandedHotelId, setExpandedHotelId] = useState("");
  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersError, setPartnersError] = useState("");
  const [reviewingPartnerId, setReviewingPartnerId] = useState("");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [tab, setTab] = useState("hotels");
  const [toast, setToast] = useState("");

  const currentUserId = (() => {
    try {
      return (
        JSON.parse(localStorage.getItem("nestly_user") || "null")?._id || ""
      );
    } catch {
      return "";
    }
  })();

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const response = await API.get("/admin/users");
      setUsers(response.data.data);
    } catch (error) {
      setUsersError(
        error.response?.data?.message ||
          "Không thể tải danh sách người dùng. Vui lòng thử lại.",
      );
    } finally {
      setUsersLoading(false);
    }
  };

  const loadPartnerApplications = async () => {
    setPartnersLoading(true);
    setPartnersError("");
    try {
      const response = await API.get("/partner/applications/pending");
      setPartners(response.data.data);
    } catch (error) {
      setPartnersError(
        error.response?.data?.message ||
          "Không thể tải yêu cầu trở thành đối tác. Vui lòng thử lại.",
      );
    } finally {
      setPartnersLoading(false);
    }
  };
  const loadHotels = async (status = hotelFilter) => {
    setItemsLoading(true);
    setItemsError("");
    try {
      const response = await API.get("/admin/hotels", { params: { status } });
      setItems(response.data.data);
      setHotelSummary(response.data.summary);
    } catch (error) {
      setItemsError(
        error.response?.data?.message ||
          "Không thể tải danh sách khách sạn. Vui lòng thử lại.",
      );
    } finally {
      setItemsLoading(false);
    }
  };
  useEffect(() => {
    // Yêu cầu ESLint bỏ qua cảnh báo này vì đây là pattern lấy dữ liệu hợp lệ
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHotels("Pending");
  }, []);

  const changeHotelFilter = (status) => {
    setHotelFilter(status);
    setExpandedHotelId("");
    loadHotels(status);
  };

  // Duyệt (Approved) hoặc Từ chối (Rejected) khách sạn
  const decideHotel = async (hotel, status) => {
    let reason;
    if (status === "Rejected") {
      reason = window.prompt(
        `Lý do từ chối "${hotel.hotelName}" (không bắt buộc):`,
        "",
      );
      if (reason === null) return; // Admin bấm Hủy
    } else if (!window.confirm(`Phê duyệt "${hotel.hotelName}" lên hệ thống?`)) {
      return;
    }

    setDecidingHotelId(hotel._id);
    setItemsError("");
    if (status === "Approved") {
      setToast(
        `Đang dùng AI Gemini tạo Vector cho ${hotel.hotelName}... Vui lòng đợi!`,
      );
    }

    try {
      const res = await API.put(`/admin/hotels/${hotel._id}/status`, {
        status,
        reason,
      });
      const updated = res.data.data;

      // Tab "Tất cả" thì cập nhật tại chỗ, các tab khác thì bỏ khỏi danh sách
      setItems((current) =>
        hotelFilter === "all"
          ? current.map((item) => (item._id === updated._id ? updated : item))
          : current.filter((item) => item._id !== updated._id),
      );
      setHotelSummary((current) => ({
        ...current,
        [hotel.status]: Math.max(0, current[hotel.status] - 1),
        [status]: current[status] + 1,
      }));
      setToast(res.data.message);
    } catch (error) {
      setToast("");
      setItemsError(
        "Lỗi khi cập nhật khách sạn: " +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setDecidingHotelId("");
    }
  };

  const decidePartner = async (partner, decision) => {
    setReviewingPartnerId(partner._id);
    setPartnersError("");
    try {
      const response = await API.put(
        `/partner/applications/${partner._id}/${decision}`,
      );
      setPartners((current) =>
        current.filter((item) => item._id !== partner._id),
      );
      setToast(response.data.message);
    } catch (error) {
      setPartnersError(
        error.response?.data?.message ||
          "Không thể xét duyệt yêu cầu. Vui lòng thử lại.",
      );
    } finally {
      setReviewingPartnerId("");
    }
  };

  const updateUserStatus = async (user) => {
    const nextStatus = user.status === "Locked" ? "Active" : "Locked";
    const actionLabel = nextStatus === "Locked" ? "khóa" : "mở khóa";
    if (
      !window.confirm(
        `Bạn có chắc muốn ${actionLabel} tài khoản ${user.fullName}?`,
      )
    ) {
      return;
    }

    setUpdatingUserId(user._id);
    setUsersError("");
    try {
      const response = await API.put(`/admin/users/${user._id}/status`, {
        status: nextStatus,
      });
      setUsers((current) =>
        current.map((item) =>
          item._id === user._id ? response.data.data : item,
        ),
      );
      setToast(response.data.message);
    } catch (error) {
      setUsersError(
        error.response?.data?.message ||
          "Không thể cập nhật trạng thái tài khoản. Vui lòng thử lại.",
      );
    } finally {
      setUpdatingUserId("");
    }
  };

  const filteredUsers = users.filter((user) => {
    const search = userSearch.trim().toLocaleLowerCase("vi");
    const matchesSearch =
      !search ||
      [user.fullName, user.email, user.phone]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("vi").includes(search));
    const matchesRole =
      userRoleFilter === "all" || user.role === userRoleFilter;
    const matchesStatus =
      userStatusFilter === "all" || user.status === userStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });
  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#b7812d]">
              <Icon name="shield" size={17} /> KHU VỰC QUẢN TRỊ
            </div>
            <h1 className="font-display mt-3 text-4xl font-semibold text-[#173b31]">
              Trung tâm quản trị
            </h1>
            <p className="mt-2 text-stone-500">
              Quản lý người dùng, đối tác và các chỗ nghỉ trên Nestly.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/rag"
              className="flex items-center gap-2 rounded-full bg-[#173b31] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#245a4b]"
            >
              <Icon name="sparkle" size={16} /> RAG Analytics
            </Link>
            <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-sm">
              <span className="size-2 rounded-full bg-emerald-500" /> Hệ thống
              hoạt động tốt
            </div>
          </div>
        </div>

        {toast && (
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <span className="flex items-center gap-2">
              <Icon name="check" />
              {toast}
            </span>
            <button onClick={() => setToast("")}>Đóng</button>
          </div>
        )}

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon="clock"
            label="Khách sạn chờ duyệt"
            value={String(hotelSummary.Pending)}
            note="Hồ sơ cần xử lý"
          />
          <StatCard
            icon="check"
            label="Khách sạn đang hoạt động"
            value={String(hotelSummary.Approved)}
            note={`${hotelSummary.Rejected} hồ sơ đã từ chối`}
          />
          <StatCard
            icon="home"
            label="Tổng chỗ nghỉ"
            value={String(hotelSummary.all)}
            note="Tất cả hồ sơ đã đăng ký"
          />
          <StatCard
            icon="users"
            label="Đơn partner chờ duyệt"
            value={partnersLoading ? "..." : String(partners.length)}
            note="Yêu cầu trở thành đối tác"
          />
        </div>

        <div className="mt-8 flex w-fit rounded-full bg-stone-200/70 p-1">
          <button
            onClick={() => setTab("hotels")}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
              tab === "hotels"
                ? "bg-white text-[#173b31] shadow-sm"
                : "text-stone-500"
            }`}
          >
            Duyệt khách sạn{" "}
            <span className="ml-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs">
              {hotelSummary.Pending}
            </span>
          </button>
          <button
            onClick={() => {
              setTab("partners");
              loadPartnerApplications();
            }}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
              tab === "partners"
                ? "bg-white text-[#173b31] shadow-sm"
                : "text-stone-500"
            }`}
          >
            Duyệt partner{" "}
            <span className="ml-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs">
              {partners.length}
            </span>
          </button>
          <button
            onClick={() => {
              setTab("users");
              loadUsers();
            }}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
              tab === "users"
                ? "bg-white text-[#173b31] shadow-sm"
                : "text-stone-500"
            }`}
          >
            Quản lý người dùng
          </button>
        </div>

        {tab === "users" && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-200 p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-[#173b31]">
                    Danh sách người dùng
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {usersLoading
                      ? "Đang tải..."
                      : `${filteredUsers.length} / ${users.length} tài khoản`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadUsers}
                  disabled={usersLoading}
                  className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
                >
                  Tải lại
                </button>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_180px]">
                <input
                  type="search"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Tìm theo tên, email hoặc số điện thoại"
                  aria-label="Tìm người dùng"
                  className="rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-[#173b31]"
                />
                <select
                  value={userRoleFilter}
                  onChange={(event) => setUserRoleFilter(event.target.value)}
                  aria-label="Lọc theo vai trò"
                  className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#173b31]"
                >
                  <option value="all">Tất cả vai trò</option>
                  <option value="Customer">Khách hàng</option>
                  <option value="Partner">Đối tác</option>
                  <option value="Admin">Quản trị viên</option>
                </select>
                <select
                  value={userStatusFilter}
                  onChange={(event) => setUserStatusFilter(event.target.value)}
                  aria-label="Lọc theo trạng thái"
                  className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#173b31]"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="Active">Đang hoạt động</option>
                  <option value="Locked">Đã khóa</option>
                </select>
              </div>
            </div>

            {usersError && (
              <div
                role="alert"
                className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
              >
                {usersError}
              </div>
            )}
            {usersLoading ? (
              <div className="p-14 text-center text-stone-500">
                Đang tải danh sách người dùng...
              </div>
            ) : usersError && users.length === 0 ? (
              <div className="p-8 text-center text-sm text-stone-500">
                Chưa thể hiển thị dữ liệu. Hãy thử tải lại sau.
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-14 text-center text-stone-500">
                {users.length === 0
                  ? "Chưa có người dùng nào."
                  : "Không tìm thấy người dùng phù hợp."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="px-6 py-4 font-bold">Người dùng</th>
                      <th className="px-6 py-4 font-bold">Liên hệ</th>
                      <th className="px-6 py-4 font-bold">Vai trò</th>
                      <th className="px-6 py-4 font-bold">Trạng thái</th>
                      <th className="px-6 py-4 font-bold">Ngày tham gia</th>
                      <th className="px-6 py-4 text-right font-bold">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredUsers.map((user) => {
                      const isCurrentUser = user._id === currentUserId;
                      return (
                        <tr key={user._id}>
                          <td className="px-6 py-4">
                            <p className="font-bold text-stone-900">
                              {user.fullName}
                            </p>
                            {isCurrentUser && (
                              <p className="mt-1 text-xs text-stone-400">
                                Tài khoản admin đang đăng nhập
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-stone-600">
                            <p>{user.email}</p>
                            <p className="mt-1 text-xs text-stone-400">
                              {user.phone || "Chưa có số điện thoại"}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-stone-600">
                            {{
                              Customer: "Khách hàng",
                              Partner: "Đối tác",
                              Admin: "Quản trị viên",
                            }[user.role] || user.role}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                user.status === "Locked"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {user.status === "Locked"
                                ? "Đã khóa"
                                : "Đang hoạt động"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-stone-600">
                            {new Date(user.createdAt).toLocaleDateString(
                              "vi-VN",
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => updateUserStatus(user)}
                              disabled={
                                isCurrentUser || updatingUserId === user._id
                              }
                              title={
                                isCurrentUser
                                  ? "Không thể đổi trạng thái tài khoản đang đăng nhập"
                                  : undefined
                              }
                              className={`rounded-full px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                user.status === "Locked"
                                  ? "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                  : "border border-red-200 text-red-700 hover:bg-red-50"
                              }`}
                            >
                              {updatingUserId === user._id
                                ? "Đang cập nhật..."
                                : user.status === "Locked"
                                  ? "Mở khóa"
                                  : "Khóa tài khoản"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "partners" && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-200 p-6">
              <h2 className="font-display text-2xl font-semibold text-[#173b31]">
                Đơn đăng ký trở thành partner
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Kiểm tra thông tin chủ sở hữu trước khi cấp quyền đăng chỗ nghỉ.
              </p>
            </div>
            <div className="divide-y divide-stone-100">
              {partnersError && (
                <div
                  role="alert"
                  className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
                >
                  {partnersError}
                  <button
                    type="button"
                    onClick={loadPartnerApplications}
                    className="ml-3 underline"
                  >
                    Tải lại
                  </button>
                </div>
              )}
              {partnersLoading ? (
                <div className="p-14 text-center text-stone-500">
                  Đang tải yêu cầu...
                </div>
              ) : partners.length === 0 && !partnersError ? (
                <div className="p-14 text-center text-stone-500">
                  Tất cả đơn đăng ký partner đã được xử lý.
                </div>
              ) : (
                partners.map((partner) => (
                  <article
                    key={partner._id}
                    className="grid gap-5 p-6 lg:grid-cols-[56px_1fr_auto] lg:items-center"
                  >
                    <span className="grid size-14 place-items-center rounded-full bg-[#e8f2ed] font-display text-lg text-[#173b31]">
                      {partner.fullName
                        .split(" ")
                        .slice(-2)
                        .map((word) => word[0])
                        .join("")}
                    </span>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-stone-900">
                          {partner.fullName}
                        </h3>
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-extrabold text-amber-700">
                          CHỜ DUYỆT
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-stone-500">
                        {partner.email}
                        {partner.phone ? ` · ${partner.phone}` : ""}
                      </p>
                      <p className="mt-2 text-xs text-stone-400">
                        Gửi lúc{" "}
                        {new Date(partner.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => decidePartner(partner, "reject")}
                        disabled={reviewingPartnerId === partner._id}
                        className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50"
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        onClick={() => decidePartner(partner, "approve")}
                        disabled={reviewingPartnerId === partner._id}
                        className="flex items-center gap-2 rounded-full bg-[#173b31] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#245a4b] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Icon name="check" size={16} />
                        {reviewingPartnerId === partner._id
                          ? "Đang xử lý..."
                          : "Duyệt partner"}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {tab === "hotels" && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-stone-200 p-6 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-2xl font-semibold text-[#173b31]">
                  Quản lý khách sạn
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {hotelFilter === "Pending"
                    ? "Ưu tiên hồ sơ đã chờ lâu nhất"
                    : `${items.length} khách sạn`}
                </p>
              </div>
              <div className="flex flex-wrap rounded-full bg-stone-100 p-1 text-xs font-bold">
                {HOTEL_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => changeHotelFilter(filter.value)}
                    className={`rounded-full px-4 py-2 transition ${
                      hotelFilter === filter.value
                        ? "bg-white shadow-sm"
                        : "text-stone-500"
                    }`}
                  >
                    {filter.label}{" "}
                    <span className="text-stone-400">
                      {hotelSummary[filter.value]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {itemsError && (
              <div
                role="alert"
                className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
              >
                {itemsError}
                <button
                  type="button"
                  onClick={() => loadHotels()}
                  className="ml-3 underline"
                >
                  Tải lại
                </button>
              </div>
            )}

            <div className="divide-y divide-stone-100">
              {itemsLoading ? (
                <div className="p-14 text-center text-stone-500">
                  Đang tải hồ sơ...
                </div>
              ) : items.length === 0 ? (
                <div className="p-16 text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                    <Icon name="check" size={25} />
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-semibold text-[#173b31]">
                    {hotelFilter === "Pending" ? "Đã xử lý hết!" : "Danh sách trống"}
                  </h3>
                  <p className="mt-2 text-sm text-stone-500">
                    Không còn hồ sơ nào trong danh sách này.
                  </p>
                </div>
              ) : (
                items.map((item) => {
                  const badge =
                    HOTEL_STATUS_BADGE[item.status] || HOTEL_STATUS_BADGE.Pending;
                  const isDeciding = decidingHotelId === item._id;
                  const isExpanded = expandedHotelId === item._id;
                  return (
                    <article key={item._id} className="p-5 lg:p-6">
                      <div className="grid gap-5 lg:grid-cols-[100px_1fr_auto] lg:items-center">
                        {/* Lấy ảnh đầu tiên, nếu không có lấy ảnh mặc định */}
                        <img
                          src={
                            item.images?.[0] ||
                            "https://images.unsplash.com/photo-1678913308053-316cee77afe9?auto=format&fit=crop&w=900&q=85"
                          }
                          alt={item.hotelName}
                          className="h-24 w-full rounded-xl object-cover lg:w-24"
                        />

                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="font-display text-xl font-semibold text-[#173b31]">
                              {item.hotelName}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            {item.reviewCount > 0 && (
                              <span className="flex items-center gap-1 text-xs font-bold text-[#b7812d]">
                                <Icon name="star" size={13} /> {item.rating}
                                <span className="font-semibold text-stone-400">
                                  ({item.reviewCount})
                                </span>
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-sm text-stone-500">
                            {[item.address?.city, item.address?.province]
                              .filter(Boolean)
                              .join(", ") || "Chưa cập nhật"}{" "}
                            · Đối tác:{" "}
                            <strong className="text-stone-700">
                              {item.partnerId?.fullName || "Không rõ"}
                            </strong>
                          </p>
                          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-stone-400">
                            <Icon name="clock" size={14} /> Gửi lúc{" "}
                            {new Date(item.createdAt).toLocaleString("vi-VN")}
                            {item.reviewedAt &&
                              ` · Xử lý lúc ${new Date(item.reviewedAt).toLocaleString("vi-VN")}`}
                          </p>
                          {item.status === "Rejected" && item.rejectionReason && (
                            <p className="mt-2 text-xs font-semibold text-red-600">
                              Lý do từ chối: {item.rejectionReason}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedHotelId(isExpanded ? "" : item._id)
                            }
                            className="rounded-full border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-700 hover:bg-stone-50"
                          >
                            {isExpanded ? "Thu gọn" : "Xem hồ sơ"}
                          </button>
                          {item.status !== "Rejected" && (
                            <button
                              type="button"
                              onClick={() => decideHotel(item, "Rejected")}
                              disabled={isDeciding}
                              className="rounded-full border border-[#c76b55]/30 px-4 py-2.5 text-sm font-bold text-[#a44f3c] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {item.status === "Approved" ? "Gỡ duyệt" : "Từ chối"}
                            </button>
                          )}
                          {item.status !== "Approved" && (
                            <button
                              type="button"
                              onClick={() => decideHotel(item, "Approved")}
                              disabled={isDeciding}
                              className="flex items-center gap-2 rounded-full bg-[#173b31] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#245a4b] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Icon name="check" size={16} />
                              {isDeciding ? "Đang xử lý..." : "Phê duyệt"}
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-5 grid gap-5 rounded-2xl bg-stone-50 p-5 text-sm text-stone-600 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <p className="font-bold text-stone-800">Mô tả</p>
                            <p className="mt-1 whitespace-pre-line">
                              {item.description || "Chưa có mô tả"}
                            </p>
                          </div>
                          <div>
                            <p className="font-bold text-stone-800">Địa chỉ</p>
                            <p className="mt-1">
                              {[
                                item.address?.street,
                                item.address?.city,
                                item.address?.province,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          </div>
                          <div>
                            <p className="font-bold text-stone-800">
                              Liên hệ đối tác
                            </p>
                            <p className="mt-1">
                              {item.partnerId?.email || "—"}
                              {item.partnerId?.phone
                                ? ` · ${item.partnerId.phone}`
                                : ""}
                            </p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="font-bold text-stone-800">Tiện ích</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.amenities?.length ? (
                                item.amenities.map((amenity) => (
                                  <span
                                    key={amenity}
                                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold"
                                  >
                                    {amenity}
                                  </span>
                                ))
                              ) : (
                                <span>Chưa khai báo</span>
                              )}
                            </div>
                          </div>
                          {item.images?.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto md:col-span-2">
                              {item.images.map((src) => (
                                <img
                                  key={src}
                                  src={src}
                                  alt={item.hotelName}
                                  className="h-20 w-28 shrink-0 rounded-lg object-cover"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
