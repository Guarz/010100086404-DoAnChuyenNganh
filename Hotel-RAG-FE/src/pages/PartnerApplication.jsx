import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import API from "../services/api";

const statusMessages = {
  NotRequested: "Bạn chưa gửi yêu cầu làm shop.",
  Pending: "Yêu cầu đã được gửi. Vui lòng chờ quản trị viên duyệt.",
  Approved: "Yêu cầu đã được duyệt. Bạn có thể vào Trung tâm đối tác.",
  Rejected: "Yêu cầu trước đó chưa được duyệt. Bạn có thể gửi lại yêu cầu.",
};

export default function PartnerApplication() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let isCurrent = true;
    API.get("/partner/application-status")
      .then((response) => {
        if (isCurrent) {
          setStatus(response.data.data.status || "NotRequested");
          if (response.data.data.role === "Partner") {
            const user = JSON.parse(localStorage.getItem("nestly_user") || "null");
            if (user) {
              localStorage.setItem(
                "nestly_user",
                JSON.stringify({ ...user, role: "Partner" }),
              );
            }
          }
        }
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(
            requestError.response?.data?.message ||
              "Không thể tải trạng thái yêu cầu. Vui lòng thử lại.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleApply = async () => {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await API.post("/partner/apply");
      setStatus(response.data.data.status);
      setMessage(response.data.message);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Không thể gửi yêu cầu. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[70vh] bg-[#f1eee6] px-5 py-14">
      <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-xl sm:p-12">
        <span className="grid size-14 place-items-center rounded-2xl bg-[#e8f2ed] text-[#173b31]">
          <Icon name="home" size={24} />
        </span>
        <p className="mt-7 text-sm font-bold uppercase tracking-widest text-[#b7812d]">
          Trở thành đối tác
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold text-[#173b31]">
          Đăng ký làm shop
        </h1>
        <p className="mt-4 leading-7 text-stone-600">
          Gửi yêu cầu để quản trị viên xét duyệt. Sau khi được duyệt, tài khoản
          của bạn sẽ có quyền truy cập Trung tâm đối tác.
        </p>

        <div className="mt-7 rounded-2xl border border-stone-200 bg-stone-50 p-5">
          <p className="text-sm font-semibold text-stone-500">Trạng thái</p>
          <p className="mt-2 font-bold text-[#173b31]">
            {loading ? "Đang tải trạng thái..." : statusMessages[status] || status}
          </p>
        </div>

        {message && (
          <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          {(status === "NotRequested" || status === "Rejected") && !loading && (
            <button
              type="button"
              onClick={handleApply}
              disabled={submitting}
              className="rounded-xl bg-[#173b31] px-6 py-3 font-bold text-white transition hover:bg-[#245a4b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Đang gửi..." : "Gửi yêu cầu làm shop"}
            </button>
          )}
          {status === "Approved" && (
            <button
              type="button"
              onClick={() => navigate("/partner")}
              className="rounded-xl bg-[#173b31] px-6 py-3 font-bold text-white transition hover:bg-[#245a4b]"
            >
              Vào Trung tâm đối tác
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-xl border border-stone-200 px-6 py-3 font-bold text-stone-700 transition hover:bg-stone-50"
          >
            Về trang chủ
          </button>
        </div>
      </section>
    </main>
  );
}
