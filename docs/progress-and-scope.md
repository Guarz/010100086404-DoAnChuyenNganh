# Tiến độ, phân công và phạm vi đề tài

> Trả lời góp ý **#1 – Hồ sơ/phạm vi** và **#8 – Ưu tiên**. Owner lấy theo tác giả commit Git; các ô
> `[nhóm bổ sung]` là thông tin chỉ nhóm biết (họ tên thật, ngày họp chốt) — cần điền trước khi nộp.

## 1. Phạm vi và tên đề tài

- **Tên đề tài thống nhất:** Website đặt phòng khách sạn (OTA) có trợ lý tìm kiếm bằng RAG — *Nestly / Hotel-RAG*.
- **Thay đổi phạm vi:** thu hẹp từ "đại lý du lịch" (tour, vé, khách sạn) sang **chỉ đặt phòng khách sạn**.
  - Thời điểm chốt: `[nhóm bổ sung: ngày họp / biên bản]`. Bằng chứng trong mã nguồn: commit đầu tiên có backend
    khách sạn ngày **13/10/2026** (`backend`), luồng RAG ngày **17/10/2026** (`RAG`); không có module tour/vé nào trong repo.
  - Lý do: `[nhóm bổ sung]` (gợi ý: tập trung chất lượng luồng booking + RAG trong thời gian đồ án).
- **Ngoài phạm vi:** tour, vé máy bay, ứng dụng di động, AI Agent (xem `docs/rag-pipeline.md`).

## 2. Bảng Task – Owner – Deadline – % – Evidence

| # | Hạng mục | Owner (Git) | Deadline | % | Evidence |
|---|---|---|---|---|---|
| 1 | Khung backend Express + MongoDB, model dữ liệu | Quanh | 13/10/2026 | 100 | commit `backend` (13/10) |
| 2 | Đăng nhập JWT, trang chủ, chi tiết KS | Quanh | 18/10/2026 | 100 | commit `login-jwt+home+detail` |
| 3 | Lịch sử đặt phòng có xác thực | mokhoar26000-sketch | 21/10/2026 | 100 | commit `Add authenticated booking history` |
| 4 | Admin: duyệt partner, quản lý user | An Tran, mokhoar26000-sketch | 23/10/2026 | 100 | commits `admin`, `Add partner approval…` |
| 5 | Tìm kiếm KS, giá động, luồng đặt phòng | Quanh, mokhoar26000-sketch | 25/10/2026 | 100 | commits 24–25/10 |
| 6 | Checkout + VNPay | Quanh | 25/10/2026 | 80 | commit `checkout-vnpay`; còn kiểm thử sandbox (Prototype) |
| 7 | RAG: embedding, vector search, sinh câu trả lời | Quanh | 29/10/2026 | 100 | commit `rag` |
| 8 | **Core Booking**: giữ chỗ nguyên tử, rollback, idempotency, cronjob hoàn quỹ | `[nhóm bổ sung]` | 31/10/2026 | 100 | `docs/booking-concurrency.md`, `tests/booking-concurrency.test.js` |
| 9 | **RAG**: tách ràng buộc cứng, kiểm tra quỹ phòng, guardrail, RagLog đầy đủ | `[nhóm bổ sung]` | 31/10/2026 | 100 | `docs/rag-pipeline.md`, `tests/rag-pipeline.test.js` |
| 10 | **RAG evaluation**: Golden set, benchmark keyword/vector/pipeline, error analysis | `[nhóm bổ sung]` | 31/10/2026 | 90 | `docs/rag-benchmark.md`; cần cập nhật nhãn Golden lỗi thời (Q12, Q19) |
| 11 | **Security**: ownership middleware, vá 4 lỗ hổng, negative tests | `[nhóm bổ sung]` | 31/10/2026 | 100 | `docs/security-rbac.md`, `tests/rbac.test.js` |
| 12 | **Hồ sơ**: báo cáo bổ sung kết luận, tài liệu tham khảo, các file trong `docs/` | `[nhóm bổ sung]` | `[nhóm bổ sung]` | 60 | thư mục `docs/`; báo cáo `.docx` cần cập nhật theo các tài liệu này |
| 13 | Partner quản lý đơn, Admin duyệt/từ chối KS | `[nhóm bổ sung]` | 31/10/2026 | 100 | `docs/implementation-status.md` |
| 14 | Review / đánh giá sao | `[nhóm bổ sung]` | 31/10/2026 | 100 | **mở rộng** — xem mục 3 |

## 3. Đối chiếu ưu tiên của giảng viên (#8)

Giảng viên yêu cầu ưu tiên **core Booking + RAG + Security + hồ sơ**, chưa mở thêm Payment/Review/Mobile/Agent.

| Ưu tiên | Trạng thái |
|---|---|
| Core Booking | Hoàn thành (#8 bảng trên) |
| RAG | Hoàn thành pipeline + đánh giá (#9, #10) |
| Security | Hoàn thành (#11) |
| Hồ sơ | Đang làm (#12) — **việc còn lại quan trọng nhất** |
| Payment | Đã có từ trước (VNPay, Prototype); không mở rộng thêm |
| Review | Đã làm trước khi nhận góp ý → ghi rõ là **phần mở rộng**, không tính vào phạm vi cốt lõi |
| Mobile / Agent | Không làm |

Hạn 28/10/2026 trong góp ý đã qua; các hạng mục 8–11 hoàn thành ngày 31/10/2026. Nhóm nên ghi nhận độ trễ này trong báo cáo.
