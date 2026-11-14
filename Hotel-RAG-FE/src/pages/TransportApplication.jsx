// File: src/pages/TransportApplication.jsx - Khách hàng đăng ký trở thành nhà xe (chờ Admin duyệt)
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import API from "../services/api";
import Icon from "../components/Icon";
import ProvinceMultiSelect from "../components/ProvinceMultiSelect";

const inputClass =
  "mt-1 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#173b31]";

// Cập nhật role trong localStorage sau khi Admin duyệt (role thật luôn được kiểm tra ở backend)
const refreshStoredUser = async () => {
  const me = (await API.get("/users/me")).data.data;
  const stored = JSON.parse(localStorage.getItem("nestly_user") || "{}");
  localStorage.setItem("nestly_user", JSON.stringify({ ...stored, ...me }));
  return me;
};

export default function TransportApplication() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("nestly_user") || "{}");
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({ companyName: "", phone: user.phone || "", licenseNumber: "", serviceProvinces: [], description: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    API.get("/transport/my-company")
      .then(async (r) => {
        const c = r.data.data;
        setCompany(c);
        if (c) {
          setForm({
            companyName: c.companyName, phone: c.phone, licenseNumber: c.licenseNumber,
            serviceProvinces: c.serviceProvinces || [], description: c.description || "",
          });
        }
        // Đã được duyệt nhưng localStorage còn role cũ -> làm mới rồi vào trung tâm nhà xe
        if (c?.status === "Approved") {
          await refreshStoredUser();
          navigate("/transport", { replace: true });
        }
      })
      .catch((e) => setError(e.response?.data?.message || "Không thể tải hồ sơ nhà xe."))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (["Partner", "Admin"].includes(user.role)) return <Navigate to="/" replace />;
  if (user.role === "Transport") return <Navigate to="/transport" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (!form.serviceProvinces.length) {
        setError("Chọn ít nhất 1 tỉnh/thành phục vụ");
        setSubmitting(false);
        return;
      }
      const r = await API.post("/transport/apply", form);
      setCompany(r.data.data);
      setMessage(r.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể gửi hồ sơ lúc này.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center font-semibold text-stone-600">Đang tải...</div>;

  const isPending = company?.status === "Pending";

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] px-4 py-10 sm:px-5 sm:py-16">
      <section className="mx-auto max-w-2xl rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
        <span className="grid size-14 place-items-center rounded-2xl bg-[#e8f2ed] text-[#173b31]"><Icon name="car" size={26} /></span>
        <h1 className="mt-6 font-display text-3xl font-semibold text-[#173b31]">Đăng ký làm nhà xe</h1>
        <p className="mt-3 leading-7 text-stone-600">
          Cung cấp dịch vụ đưa đón sân bay – khách sạn cho khách của Nestly. Hồ sơ sẽ được quản trị viên kiểm tra giấy phép kinh doanh vận tải trước khi duyệt.
        </p>

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</p>}

        {isPending ? (
          <div role="status" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-900">Hồ sơ "{company.companyName}" đang chờ duyệt</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">Bạn sẽ thấy mục "Trung tâm nhà xe" sau khi hồ sơ được duyệt.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 grid gap-4">
            {company?.status === "Rejected" && (
              <p className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                Hồ sơ trước chưa được chấp thuận{company.rejectionReason ? `: ${company.rejectionReason}` : ""}. Bạn có thể chỉnh sửa và gửi lại.
              </p>
            )}
            <label className="text-sm font-semibold text-stone-700">Tên nhà xe
              <input required minLength={2} value={form.companyName} onChange={set("companyName")} className={inputClass} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-stone-700">Số điện thoại
                <input required value={form.phone} onChange={set("phone")} inputMode="tel" placeholder="0905xxxxxx" className={inputClass} />
              </label>
              <label className="text-sm font-semibold text-stone-700">Số giấy phép kinh doanh vận tải
                <input required minLength={3} value={form.licenseNumber} onChange={set("licenseNumber")} className={inputClass} />
              </label>
            </div>
            <div className="text-sm font-semibold text-stone-700">
              Tỉnh/thành phục vụ
              <ProvinceMultiSelect
                value={form.serviceProvinces}
                onChange={(serviceProvinces) => setForm((f) => ({ ...f, serviceProvinces }))}
                className={inputClass}
              />
            </div>
            <label className="text-sm font-semibold text-stone-700">Giới thiệu
              <textarea rows={3} value={form.description} onChange={set("description")} className={inputClass} />
            </label>
            <button disabled={submitting} className="mt-2 flex w-fit items-center gap-2 rounded-full bg-[#173b31] px-6 py-3.5 font-bold text-white hover:bg-[#245a4b] disabled:opacity-60">
              <Icon name="arrow" /> {submitting ? "Đang gửi..." : company ? "Gửi lại hồ sơ" : "Gửi hồ sơ"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
