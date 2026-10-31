# Nhật ký thay đổi và tiến độ dự án Hotel-RAG (Nestly)

> **Quy ước ghi:** file này **chỉ ghi thêm (append-only)**.
> - Mỗi lần thay đổi, thêm một mục mới **ở cuối danh sách**, ngay phía trên khối "MẪU" (khối mẫu luôn nằm cuối file).
> - **Không sửa hay xóa** các mục cũ. Nếu mục cũ có điểm sai hoặc đã lỗi thời, ghi một mục mới nêu rõ "đính chính mục ngày …".
> - Mỗi mục ghi: ngày, người thực hiện, thay đổi, file chính, cách kiểm chứng, việc còn lại.
>
> Tài liệu hướng dẫn cài đặt và chạy dự án nằm ở [`README.md`](README.md); tài liệu nộp kèm báo cáo nằm trong [`docs/`](docs/).

---

## [05/10 – 29/10/2026] Mốc ban đầu (tổng hợp từ lịch sử Git)

**Người thực hiện:** Quanh, mokhoar26000-sketch, An Tran (theo tác giả commit)

**Đã có:**

| Ngày | Commit | Nội dung |
|---|---|---|
| 13/10 | `backend` | Khung backend Express + MongoDB, các model User, Hotel, RoomType, RoomInventory, Booking, Payment |
| 17/10 | `RAG` | Embedding Gemini cho khách sạn, Atlas Vector Search |
| 18/10 | `login-jwt+home+detail` | Đăng nhập JWT, trang chủ, chi tiết khách sạn |
| 21/10 | `Add authenticated booking history` | Lịch sử đặt phòng có xác thực |
| 23/10 | `admin`, `Add partner approval and demo payments` | Admin quản lý user, duyệt partner; thanh toán demo |
| 24/10 | `Hoàn thiện luồng Tìm kiếm Khách sạn và Lịch sử Đặt phòng` | Tìm kiếm, top 8, giá động theo ngày |
| 25/10 | `checkout-vnpay`, `Hoàn thiện đăng ký đối tác và luồng đặt phòng`, `fix` | Checkout đếm ngược 5 phút, VNPay, partner quản lý hạng phòng và quỹ phòng |
| 29/10 | `rag` | Hoàn thiện trợ lý RAG |

**Tiến độ ước tính:** khoảng 80% chức năng.

---

## [31/10/2026] Hoàn thiện 20% chức năng còn lại

**Người thực hiện:** Quanh (code hỗ trợ bởi Claude Code)

**Thay đổi:**
- **Admin Dashboard:**
  - API `GET /api/admin/hotels?status=` và `PUT /api/admin/hotels/:id/status`.
  - Thêm trạng thái `Rejected` kèm lý do từ chối.
  - Giao diện lọc Chờ duyệt / Đã duyệt / Từ chối / Tất cả, có nút Duyệt / Từ chối / Xem hồ sơ.
- **Partner quản lý đơn:**
  - API `GET /api/partner/bookings` và `PUT /api/partner/bookings/:id/complete`.
  - Component `PartnerBookings.jsx` với các tab Nhận phòng hôm nay / Trả phòng hôm nay / Đang lưu trú / Sắp đến; thẻ thống kê lấy số liệu thật.
- **Đánh giá (Review):**
  - API `POST /api/reviews` (chỉ cho đơn `Completed`, mỗi đơn đánh giá một lần) và `GET /api/reviews/hotel/:id`.
  - Tự tính lại `Hotel.rating` và `reviewCount`.
  - Giao diện chấm sao trong Profile và khối đánh giá ở trang chi tiết khách sạn.
- **Cronjob (`node-cron`):**
  - Mỗi phút hủy đơn `Pending` quá 5 phút và hoàn `availableRooms`.
  - Mỗi ngày lúc 00:05 chuyển đơn đã qua ngày trả phòng sang `Completed`.
- **Sửa lỗi phát hiện được:**
  - Tạo đơn trước đây **không trừ quỹ phòng**. Nay trừ ngay khi tạo đơn, theo cách nguyên tử từng đêm, có rollback.
  - Bỏ TTL index tự xóa đơn `Pending` (làm mất quỹ phòng).
  - Link VNPay hết hạn cùng lúc với thời gian giữ chỗ.
  - Tạo khách sạn không có tọa độ bị lỗi 500 trên DB có index `2dsphere`.
  - Route `/hotels/featured` đặt sau `/:id` nên không chạy.
  - Thông báo "tạo Vector AI thành công" sai khi Gemini lỗi.

**File chính:** `controllers/adminController.js`, `partnerController.js`, `reviewController.js`, `bookingController.js`, `services/inventoryService.js`, `jobs/bookingCron.js`, `AdminDashboard.jsx`, `PartnerBookings.jsx`, `ProfilePage.jsx`, `HotelDetail.jsx`, `HotelReviews.jsx`, `StarRating.jsx`.

**Kiểm chứng:**
- 30 kịch bản end-to-end trên MongoDB tạm ở máy, đều pass.
- Kiểm tra giao diện trên trình duyệt với 3 vai trò.

---

## [31/10/2026] Rà soát và chuẩn hóa dữ liệu MongoDB Atlas (Cluster0 / `Hotel-RAG`)

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi dữ liệu** (qua script `Hotel-RAG-BE/scripts/seedMockData.js`, chạy lại không sinh dữ liệu trùng):
- **Users:**
  - Sửa `partnerApplicationStatus` sai enum (`approve`).
  - Tạo partner bị thiếu (`640000000000000000000001`) mà khách sạn đang tham chiếu tới.
  - Thêm 12 khách hàng mock `mock.customer*@nestly.test`.
- **Hotels:**
  - Thay ảnh hỏng (`example.com` và các ảnh Unsplash bị 404); mỗi khách sạn có 5 ảnh hợp lệ.
  - Bổ sung tọa độ.
  - Tính lại `rating` từ review thật thay cho số gán cứng.
  - Tạo lại 8 vector embedding bị rỗng hoặc hỏng (có vector chỉ 5 chiều).
- **RoomTypes:**
  - Thêm 27 hạng phòng cho 11 khách sạn đã duyệt mà chưa có phòng (trước đó không bao giờ xuất hiện trong tìm kiếm).
  - Sửa ảnh và điền các trường còn thiếu.
- **RoomInventories:** mở bán 60 ngày tới cho mọi hạng phòng (thêm 2.260 bản ghi).
- **Bookings / Payments / Reviews (mock):**
  - 68 đơn `Completed` kèm thanh toán và 65 đánh giá.
  - 28 đơn `Confirmed` sắp tới (đã trừ quỹ phòng).
  - 5 đơn `Canceled` kèm payment `Failed`.
- Xóa 2 collection rỗng tạo nhầm: `RagLog` và `ratings`.

**Sửa code ghi log:**
- `raglogs` trước đây **luôn rỗng**: route `/api/ai/search` không ghi log, còn `ragController.js` là code chết.
- Payment chỉ được ghi khi thành công. Nay ghi thêm cả giao dịch `Failed`.
- **Lỗi lớn:** server chạy Express 5, trong đó `req.query` không có prototype, nên **mọi callback VNPay trả 500**. Đã sửa.
- API chấm Groundedness gọi model `gemini-1.5-flash` đã bị gỡ. Chuyển sang `gemini-3.8-flash`.
- Trang RAG Analytics đọc sai token và chưa có route. Đã thêm `/admin/rag`.
- `createRoomType` lưu ngày quỹ phòng theo giờ địa phương, lệch với `updateInventory` (dùng mốc UTC). Đã thống nhất về 00:00 UTC.

**Kiểm chứng:**
- Kiểm tra lại toàn bộ collection sau khi chạy script.
- Test VNPay với chữ ký hợp lệ trên DB local.
- Chạy lại 30 câu golden qua API thật: ghi được 15/30 RagLog. 15 câu còn lại lỗi do Gemini (9 lần 429 hết hạn mức, 6 lần 503 quá tải).

---

## [31/10/2026] Xử lý góp ý của giảng viên (file góp ý `Book1.xlsx`)

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi theo từng góp ý:**
- **#2 Thuật ngữ AI:** xác định sản phẩm là **RAG Chatbot**, không phải AI Agent; ghi rõ lý do trong `docs/rag-pipeline.md`.
- **#3 Đánh giá RAG:**
  - `scripts/ragBenchmark.js` so sánh keyword, vector và pipeline trên cùng Golden Query Set.
  - Đo HitRate, Recall, Precision, nDCG, MRR @5, tỉ lệ từ chối đúng câu ngoài phạm vi, kèm error analysis.
  - `services/ragMetrics.js` dùng chung cho benchmark và trang Admin RAG Analytics (có thêm citation correctness và groundedness).
- **#4 Ràng buộc cứng:**
  - Pipeline mới: tách ràng buộc (`queryConstraintParser.js`) → lọc có cấu trúc → kiểm tra quỹ phòng mọi đêm và ngân sách theo giá động → xếp hạng ngữ nghĩa (`ragRetrieval.js`).
  - Thêm guardrail cho câu hỏi độc hại hoặc ngoài phạm vi.
  - Khi Gemini lỗi, trả câu trả lời dựng từ dữ liệu thay vì lỗi 500.
  - Widget chat hiển thị các ràng buộc đã hiểu, giá và số phòng còn trống.
- **#5 Đặt phòng đồng thời:**
  - Thêm `Idempotency-Key` cho `POST /api/bookings`, có unique index; frontend tự sinh key.
  - Test đồng thời: stock = 1 với 2 request, stock = 3 với 10 request; test rollback nhiều đêm và idempotency.
- **#6 RBAC / Ownership:**
  - Thêm `middleware/ownershipMiddleware.js`.
  - Vá 4 lỗ hổng:
    - Customer khóa được phòng bất kỳ.
    - Partner A sửa được giá và quỹ phòng của Partner B.
    - Ai đăng nhập cũng xem được quỹ phòng.
    - Tạo được link thanh toán cho đơn của người khác.
  - Tài khoản bị khóa không đăng nhập được nữa.
  - Bổ sung negative test 401/403.
- **#7 Thật / mock:**
  - Nút "Lưu thay đổi" ở Profile nay gọi API thật (`/api/users/me`); thêm chức năng đổi mật khẩu.
  - Gỡ tab "Phương thức thanh toán" đang để trống.
  - Bảng phân loại Implemented / Prototype / Mock / Planned.
- **#1, #8 Hồ sơ:** bảng Task–Owner–Deadline–%–Evidence và đối chiếu thứ tự ưu tiên.
- **Hạ tầng:**
  - Tách `createApp.js` khỏi `server.js` để test được.
  - Thêm các lệnh `npm test`, `npm run rag:benchmark`, `npm run rag:replay`, `npm run seed:mock`.
  - Cập nhật `README.md`.
  - Xóa `ragController.js` (code chết).

**Tài liệu mới:** `docs/rag-pipeline.md`, `docs/rag-benchmark.md`, `docs/booking-concurrency.md`, `docs/security-rbac.md`, `docs/implementation-status.md`, `docs/progress-and-scope.md`.

**Kiểm chứng:**
- `npm test`: 36/36 test pass.
- Benchmark @5 trên corpus đóng băng:

  | Phương pháp | HitRate | nDCG | Từ chối đúng |
  |---|---|---|---|
  | keyword | 0.870 | 0.728 | 0/7 |
  | vector | 0.739 | 0.531 | 0/7 |
  | pipeline | 0.913 | 0.868 | 7/7 |

- Gọi `/api/ai/search` trên dữ liệu Atlas thật: 38 → 9 → 6 ứng viên, top 5 đúng mọi ràng buộc.
- Build và lint frontend sạch.

**Việc còn lại:**
- Điền các ô `[nhóm bổ sung]` trong `docs/progress-and-scope.md` (họ tên, ngày chốt phạm vi, owner các hạng mục 8–14).
- Cập nhật nhãn Golden lỗi thời cho Q12 và Q19 (phòng đáp án đang bị khóa bảo trì).
- Chạy lại `npm run rag:replay` khi Gemini hết bị giới hạn, để có số liệu groundedness và citation từ câu trả lời LLM thật.
- Kiểm thử VNPay end-to-end trên sandbox (hiện ở mức Prototype).
- Cập nhật báo cáo `.docx` theo các tài liệu trong `docs/`.
- Commit và gắn tag phiên bản nộp: **tại thời điểm ghi mục này, toàn bộ thay đổi ngày 31/10 chưa được commit**.

**Tiến độ:** chức năng khoảng 95% (còn VNPay sandbox); hồ sơ khoảng 60%.

---

## [31/10/2026] Commit toàn bộ thay đổi ngày 31/10 lên GitHub

**Người thực hiện:** Quanh (hỗ trợ bởi Claude Code)

**Thay đổi:**
- Commit tất cả code, script, test và tài liệu của 3 mục ngày 31/10 phía trên lên nhánh `feature/hoan-thien-gop-y` của repo `Guarz/010100086404-DoAnChuyenNganh` (chưa gộp vào `main`).
- **Không** đưa vào commit:
  - việc xóa `baocaonhom13.docx` (thay đổi có sẵn từ trước, chưa rõ chủ ý);
  - các thay đổi trong `node_modules/` (`node-cron` đã khai báo trong `package.json`, cài bằng `npm install`);
  - `.claude/settings.json` (cấu hình máy cá nhân).

**Kiểm chứng:** `git log` trên nhánh và trang GitHub của nhánh.

**Việc còn lại:**
- Tạo Pull Request từ `feature/hoan-thien-gop-y` vào `main`, xem lại rồi merge.
- Sau khi pull về, mỗi máy chạy `npm install` ở thư mục gốc để cài `node-cron`.

**Tiến độ:** không đổi so với mục trước.

---

<!--
MẪU CHO MỤC MỚI — sao chép và dán ngay PHÍA TRÊN khối này, KHÔNG sửa các mục cũ:

## [dd/mm/yyyy] Tiêu đề ngắn

**Người thực hiện:**

**Thay đổi:**
-

**File chính:**

**Kiểm chứng:**

**Việc còn lại:**

**Tiến độ:**

---
-->
