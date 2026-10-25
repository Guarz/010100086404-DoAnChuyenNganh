import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import API from "../services/api";
import Icon from "../components/Icon";

export default function PartnerApplication() {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadApplicationStatus = async () => {
      try {
        const response = await API.get("/partner/application-status");
        setApplication(response.data.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Không thể tải trạng thái đăng ký. Vui lòng thử lại.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadApplicationStatus();
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await API.post("/partner/apply");
      setApplication((current) => ({
        ...current,
        status: response.data.data.status,
      }));
      setMessage(response.data.message);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Không thể gửi yêu cầu lúc này. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="grid min-h-[60vh] place-items-center bg-[#f7f5ef]">
        <p className="font-semibold text-stone-600">Đang tải trạng thái...</p>
      </main>
    );
  }

  if (application?.role === "Partner") {
    return <Navigate to="/partner" replace />;
  }

  if (application?.role === "Admin") {
    return <Navigate to="/admin" replace />;
  }

  const isPending = application?.status === "Pending";
  const isRejected = application?.status === "Rejected";

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-16">
      <section className="mx-auto max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm sm:p-12">
        <span className="grid size-14 place-items-center rounded-2xl bg-[#e8f2ed] text-[#173b31]">
          <Icon name="home" size={25} />
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold text-[#173b31]">
          Đăng ký trở thành đối tác
        </h1>
        <p className="mt-3 leading-7 text-stone-600">
          Gửi yêu cầu để quản trị viên xem xét quyền đăng chỗ nghỉ trên Nestly.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        )}

        {isPending ? (
          <div
            role="status"
            className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"
          >
            <p className="font-bold text-amber-900">Yêu cầu đang chờ duyệt</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Yêu cầu của bạn đã được gửi đến quản trị viên. Vui lòng đợi xét
              duyệt.
            </p>
          </div>
        ) : (
          <>
            {isRejected && (
              <p className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                Yêu cầu trước đó chưa được chấp thuận. Bạn có thể gửi lại yêu
                cầu để được xem xét.
              </p>
            )}
            {message && (
              <p
                role="status"
                className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"
              >
                {message}
              </p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-8 flex items-center gap-2 rounded-full bg-[#173b31] px-6 py-3.5 font-bold text-white transition hover:bg-[#245a4b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="arrow" size={18} />
              {submitting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu đăng ký"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
