# Trạng thái triển khai: Implemented / Prototype / Mock / Planned

> Trả lời góp ý **#7 – Implementation thật**. Cập nhật ngày 31/10/2026.
> Định nghĩa: **Implemented** = giao diện gọi API thật, đọc/ghi MongoDB, có test hoặc kiểm chứng end-to-end ·
> **Prototype** = chạy được nhưng chưa kiểm chứng đủ với hệ thống bên ngoài · **Mock** = dữ liệu/giao diện giả lập ·
> **Planned** = chưa làm.

## 1. Chức năng

| Chức năng | Màn hình | API | Collection | Trạng thái | Minh chứng |
|---|---|---|---|---|---|
| Đăng ký / đăng nhập JWT | `/login`, `/register` | `POST /api/auth/*` | users | Implemented | rbac.test.js (401) |
| Hồ sơ cá nhân, đổi mật khẩu | `/profile` (Thông tin, Bảo mật) | `GET/PUT /api/users/me`, `PUT /me/password` | users | Implemented | — |
| Tìm khách sạn theo thành phố / ngày / số khách | `/hotels` | `GET /api/hotels/search` | hotels, roomtypes, roominventories | Implemented | — |
| Chi tiết KS, giá động theo ngày | `/hotels/:id` | `GET /api/hotels/:id/rooms` | roominventories | Implemented | — |
| Đặt phòng, giữ chỗ 5 phút, chống oversell, idempotency | `/hotels/:id` → `/checkout/:id` | `POST /api/bookings` | bookings, roominventories | Implemented | booking-concurrency.test.js |
| Tự hủy đơn quá hạn, hoàn quỹ (cronjob) | — | `jobs/bookingCron.js` | bookings, roominventories | Implemented | booking-concurrency.test.js |
| Thanh toán VNPay | `/checkout/:id`, `/payment/vnpay-return` | `POST /api/payments/vnpay/create_url`, `GET /vnpay/return` | payments | **Prototype** | Ký/kiểm chữ ký HMAC đã test với secret giả; **chưa chạy end-to-end trên VNPay sandbox** sau khi sửa lỗi Express 5 (`req.query` không có prototype làm callback trả 500). 2 payment cũ trong DB là `Demo`. |
| Lịch sử đơn, hủy đơn | `/profile` → Lịch sử đặt chỗ | `GET /api/bookings/my-bookings`, `PUT /:id/cancel` | bookings | Implemented | — |
| Đánh giá 1–5 sao sau khi hoàn tất, điểm TB khách sạn | `/profile`, `/hotels/:id` | `POST /api/reviews`, `GET /api/reviews/hotel/:id` | reviews, hotels.rating | Implemented (mở rộng ngoài phạm vi ưu tiên, xem góp ý #8) | rbac.test.js |
| Partner: đăng ký làm đối tác | `/partner-apply` | `/api/partner/apply` | users | Implemented | — |
| Partner: tạo KS, hạng phòng, khóa phòng, giá/quỹ theo ngày | `/partner` | `/api/partner/hotels`, `/rooms`, `/inventory` | hotels, roomtypes, roominventories | Implemented | rbac.test.js (ownership) |
| Partner: quản lý đơn, nhận/trả phòng | `/partner` | `GET /api/partner/bookings`, `PUT /:id/complete` | bookings | Implemented | rbac.test.js |
| Admin: duyệt/từ chối KS, duyệt partner, khóa user | `/admin` | `/api/admin/*` | hotels, users | Implemented | rbac.test.js |
| Trợ lý RAG (ràng buộc cứng + xếp hạng ngữ nghĩa) | Widget chat mọi trang | `POST /api/ai/search` | hotels.embedding, raglogs | Implemented | rag-pipeline.test.js, docs/rag-benchmark.md |
| RAG Analytics (HitRate, Recall, Precision, nDCG, MRR, citation, groundedness) | `/admin/rag` | `GET /api/admin/rag-analytics`, `POST /rag/evaluate` | raglogs | Implemented | — |
| Thanh toán Momo / tiền mặt, phương thức thanh toán đã lưu | — | — | — | **Planned** (tab đã gỡ khỏi Profile) | — |
| Ứng dụng di động, AI Agent | — | — | — | **Planned** (không thuộc phạm vi, xem góp ý #8) | — |
| Nút "Xem tất cả ảnh" ở chi tiết KS | `/hotels/:id` | — | — | **Mock** (nút chưa có hành động) | — |

## 2. Dữ liệu trên MongoDB Atlas (`Hotel-RAG`)

| Loại | Nhận diện | Ghi chú |
|---|---|---|
| Dữ liệu thật do nhóm/người dùng tạo qua giao diện | còn lại | |
| **Mock** – 12 khách hàng | email `mock.customer*@nestly.test` | mật khẩu chung trong `scripts/seedMockData.js` |
| **Mock** – đơn đặt phòng / thanh toán / đánh giá | `_id` bắt đầu bằng `6d0cb0` / `6d0cc0` / `6d0cd0` | sinh bởi `npm run seed:mock`, tất định, chạy lại không trùng |
| **Mock** – hạng phòng cho KS chưa có phòng | tên dạng `Standard Double - <Tên KS>` | |
| **Test data** – 10 khách sạn benchmark | tên bắt đầu `[TEST]`, partner `search-benchmark-partner@nestly.test` | |
| Ảnh khách sạn / phòng | `images.unsplash.com` | script kiểm tra từng URL (HEAD), thay ảnh 404 / `example.com` |
| RagLog | collection `raglogs` | log tạo trước 31/10 là định dạng cũ (không có `constraints`); log mới có đủ ràng buộc + thứ tự truy xuất |

## 3. Cùng một phiên bản

Để screenshot, API, collections và RAG logs khớp nhau khi nộp:
1. Commit toàn bộ code và gắn tag (ví dụ `v1.0-gop-y`).
2. Chạy `npm test`, `npm run rag:benchmark`, `npm run rag:replay` trên đúng commit đó.
3. Chụp màn hình sau khi chạy các lệnh trên; ghi mã commit vào báo cáo.
