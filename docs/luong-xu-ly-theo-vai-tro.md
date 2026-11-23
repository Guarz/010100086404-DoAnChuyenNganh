# Luồng xử lý theo use case của từng vai trò — Nestly (Hotel-RAG)

Tài liệu mô tả **đường đi của dữ liệu** cho từng use case: người dùng thao tác gì trên giao diện → API nào được gọi → backend kiểm tra gì, ghi gì vào MongoDB → kết quả trả về.

Tài liệu liên quan:
- pipeline chatbot chi tiết: [`rag-pipeline.md`](rag-pipeline.md);
- chống đặt trùng: [`booking-concurrency.md`](booking-concurrency.md);
- ma trận phân quyền: [`security-rbac.md`](security-rbac.md);
- ý nghĩa từng trường dữ liệu: [`data-dictionary.md`](data-dictionary.md).

## 1. Luồng chung của mọi yêu cầu

Frontend (React, `Hotel-RAG-FE`) gọi backend (Express, `Hotel-RAG-BE`) qua REST API tại `VITE_API_URL`. Mọi request đi qua cùng một chuỗi kiểm tra trước khi vào controller:

```
Request từ trình duyệt (Axios tự gắn header Authorization: Bearer <JWT>)
  │
  ├─(1) CORS ─ chỉ nhận domain trong CORS_ORIGIN
  │
  ├─(2) authenticateUser ─ JWT hợp lệ? tài khoản còn tồn tại và không bị khóa (Locked)?
  │      sai → 401 / 403        (API công khai như xem khách sạn, tìm xe, chatbot bỏ qua bước này)
  │
  ├─(3) authorizeRoles ─ đúng vai trò (Customer / Partner / Transport / Admin)?   sai → 403
  │
  ├─(4) Kiểm tra sở hữu ─ khách sạn / hạng phòng / loại xe / tuyến / đơn có thuộc người này?   sai → 403 / 404
  │
  ├─(5) Controller ─ kiểm tra dữ liệu gửi lên (định dạng ngày, số lượng, ObjectId...)
  │
  └─(6) Service + MongoDB ─ quỹ phòng, quỹ xe, mã giảm giá, thông báo, thống kê, AI
         gọi dịch vụ ngoài khi cần: VNPay (thanh toán), Ollama trên Colab (AI), Brevo (email)
```

Frontend lưu `nestly_token` và `nestly_user` trong `localStorage`. Các trang cần đăng nhập được bọc bởi `ProtectedRoute` theo vai trò. Đây chỉ là lớp giao diện: **backend luôn tự kiểm tra lại** quyền ở bước (2)–(4).

---

## 2. Khách hàng (Customer)

Vai trò mặc định khi đăng ký. Khách chưa đăng nhập vẫn dùng được 2.2, 2.3 và phần tìm xe của 2.8.

### 2.1 Đăng ký, xác nhận email, đăng nhập, quên mật khẩu

```
Đăng ký (POST /api/auth/register)  — controllers/authController.js
  ├─(1) Kiểm tra tên đăng nhập chưa tồn tại (email được phép trùng nhiều tài khoản)
  ├─(2) Lưu user: mật khẩu băm bcrypt, emailVerified = false,
  │      HASH của token xác nhận + hạn dùng (token gốc không lưu trong DB)
  └─(3) Gửi email qua Brevo chứa link /verify-email?token=...

Xác nhận email (POST /api/auth/verify-email)
  └─ băm token trong link, so với hash đã lưu, còn hạn → emailVerified = true

Đăng nhập (POST /api/auth/login)
  ├─(1) Tìm theo tên đăng nhập, so mật khẩu bằng bcrypt
  ├─(2) Tài khoản Locked → từ chối; chưa xác nhận email → 403 EMAIL_NOT_VERIFIED
  └─(3) Trả JWT + thông tin user → frontend lưu vào localStorage

Quên mật khẩu (POST /api/auth/forgot-password → POST /api/auth/reset-password)
  ├─ gửi link đặt lại (hạn 30 phút, mỗi email cách nhau ít nhất 60 giây)
  └─ đặt lại: kiểm tra hash token + hạn → lưu mật khẩu mới (bcrypt), xóa token
```

Gửi lại email xác nhận: `POST /api/auth/resend-verification`. Token chỉ lưu dạng hash nên dù lộ database cũng không dùng lại được link.

### 2.2 Tìm, lọc và xem khách sạn

```
Trang chủ
  ├─ GET /api/hotels/featured   → top khách sạn theo rating
  └─ GET /api/hotels/provinces  → 63 tỉnh kèm số khách sạn (cho ô chọn điểm đến)

Trang Khách sạn (GET /api/hotels/search?province=&amenities=&checkIn=&checkOut=&...)
  ├─(1) Chỉ lấy khách sạn status = Approved
  ├─(2) Lọc theo tỉnh, tiện nghi (danh mục từ GET /api/hotels/amenities)
  └─(3) Tính priceFrom = giá thấp nhất của các hạng phòng đang bán

Trang Chi tiết
  ├─ GET /api/hotels/:id               → thông tin, ảnh, tiện ích
  ├─ GET /api/hotels/:id/rooms?checkIn=&checkOut=
  │      hạng phòng đang bán + giá từng đêm (roominventories.dynamicPrice, không có thì basePrice)
  │      + số phòng còn trống trong khoảng ngày
  └─ GET /api/reviews/hotel/:hotelId   → đánh giá của khách
```

### 2.3 Hỏi trợ lý AI (chatbot RAG): tìm phòng và xe đưa đón

```
Câu hỏi (POST /api/ai/search, công khai)  — controllers/aiController.js
  │
  ├─(1) Tách ràng buộc cứng (queryConstraintParser, dùng luật, không gọi AI)
  │      thành phố · tỉnh · ngày · số khách · ngân sách · tiện nghi · loại phòng · ý định đặt xe
  │
  ├─(0) Guardrail ─ câu ngoài phạm vi / prompt injection → từ chối, không truy xuất, ghi RagLog
  │
  ├─ Nếu hỏi chỗ ở:
  │   ├─(2) Lọc cứng: KS Approved, phòng đang bán, đúng thành phố / tỉnh, sức chứa, tiện nghi
  │   ├─(3) Còn đủ phòng MỌI đêm + giá theo ngày nằm trong ngân sách
  │   └─(4) Xếp hạng: 0,7 × cosine(vector câu hỏi, vector KS — bge-m3) + 0,3 × điểm từ khóa
  │
  ├─ Nếu hỏi xe đưa đón:
  │   └─(4b) Đã có tỉnh → tìm tuyến còn xe theo tỉnh, ngày, số khách (findTransferOptions),
  │           tuyến đúng chiều sân bay xếp trước;  chưa có tỉnh → hỏi lại tỉnh/thành
  │
  ├─(5) dolphin3 (Ollama) viết câu trả lời, chỉ dùng danh sách đã đánh số [n] (phòng) / [Xn] (xe)
  │      Ollama lỗi / tắt → câu trả lời dựng sẵn từ dữ liệu (không báo lỗi 500)
  │
  └─(6) Ghi RagLog: ràng buộc, thứ tự truy xuất, tuyến xe, số ứng viên từng bước, độ trễ
```

Widget chat hiện câu trả lời, nhãn ràng buộc đã hiểu, thẻ phòng (mở trang khách sạn) và thẻ xe (mở `/transfers?province=&date=&passengers=`). Chi tiết: [`rag-pipeline.md`](rag-pipeline.md).

### 2.4 Đặt phòng (giữ chỗ 5 phút)

```
Khách chọn hạng phòng, ngày, số phòng → "Xác nhận đặt"
POST /api/bookings (+ header Idempotency-Key)  — controllers/bookingController.js
  │
  ├─(1) Đã có đơn cùng Idempotency-Key của khách này → trả lại đơn cũ (bấm 2 lần không tạo 2 đơn)
  │
  ├─(2) Giữ phòng (services/inventoryService.reserveRooms), với TỪNG đêm:
  │      updateOne { availableRooms ≥ số phòng }  →  $inc availableRooms: −số phòng   (nguyên tử)
  │      một đêm không đủ → hoàn lại các đêm đã trừ → 409 Hết phòng
  │
  ├─(3) Tạo booking: bookingStatus = Pending, chốt giá từng đêm,
  │      expiresAt = bây giờ + 5 phút
  │
  └─(4) Frontend chuyển tới /checkout/:id (đếm ngược 5 phút)
```

Hai khách đặt cùng lúc không thể làm quỹ phòng âm, vì mỗi đêm được trừ bằng một lệnh có điều kiện (xem [`booking-concurrency.md`](booking-concurrency.md)). Hết 5 phút chưa thanh toán thì cronjob hủy đơn và hoàn phòng (mục 6).

### 2.5 Áp mã giảm giá

```
PUT /api/bookings/:id/coupon { code }      (bỏ mã: DELETE; đơn xe: /api/transfers/:id/coupon)
Gợi ý mã dùng được: GET /api/coupons/available
  │
  ├─(1) Đơn phải của khách này và đang Pending
  │
  ├─(2) Kiểm tra mã (services/couponService.validateCoupon):
  │      đang bật · trong thời gian dùng · đúng phạm vi (phòng / xe / cả hai, hoặc đúng KS
  │      nếu là mã của Partner) · đơn đạt giá trị tối thiểu · còn lượt tổng · còn lượt cho khách này
  │
  ├─(3) Giữ 1 lượt: $inc usedCount có điều kiện chưa vượt usageLimit (nguyên tử)
  │
  ├─(4) Tính giảm: theo % (có trần maxDiscount) hoặc số tiền cố định; luôn để lại ≥ 10.000₫ phải trả
  │      lưu subtotalAmount, coupon { couponId, code, discountAmount }, totalAmount mới
  │
  └─ Trả lại lượt (releaseUse) khi: khách bỏ / đổi mã, hủy đơn, đơn hết hạn
```

### 2.6 Thanh toán VNPay

```
Bấm "Thanh toán qua VNPay"
POST /api/payments/vnpay/create_url { bookingId | transferBookingId }  — controllers/paymentController.js
  ├─(1) Đơn của khách này, đang Pending, chưa hết hạn giữ chỗ?
  └─(2) Tạo URL VNPay: số tiền = totalAmount × 100, giờ theo GMT+7,
         hạn link = hạn giữ chỗ, ký HMAC-SHA512 bằng VNP_HASH_SECRET → frontend chuyển sang VNPay

Khách nhập thẻ trên VNPay → VNPay chuyển về /payment/vnpay-return?vnp_...
GET /api/payments/vnpay/return?vnp_...
  │
  ├─(1) Tính lại chữ ký, so với vnp_SecureHash  → sai: 400, không xử lý gì
  │
  ├─(2) Mã 00 VÀ số tiền đã trả = totalAmount hiện tại của đơn
  │      ├─ findOneAndUpdate { status: Pending } → Confirmed  (chỉ thành công 1 lần)
  │      ├─ ghi payments: Success + vnp_TransactionNo
  │      └─ thông báo: chủ KS / nhà xe "đơn mới", khách "đặt thành công"
  │
  └─(3) Thất bại / số tiền lệch → ghi payments: Failed; đơn vẫn Pending (cronjob sẽ hủy)
```

- Kiểm tra số tiền chặn trường hợp tạo link lúc đang có mã giảm giá, sau đó bỏ mã nhưng vẫn trả giá thấp.
- Tải lại trang kết quả không tạo trùng Payment, vì cập nhật chỉ thành công khi đơn còn `Pending`.

### 2.7 Vòng đời đơn phòng: hủy, hết hạn, hoàn thành, đánh giá

```
Pending ──(thanh toán VNPay thành công)──────────────────────────► Confirmed
   │                                                                   │
   ├─(khách tự hủy: PUT /api/bookings/:id/cancel)──► Canceled           ├─(đối tác bấm "Khách đã trả phòng")──► Completed
   └─(cronjob: quá 5 phút chưa trả)────────────────► Canceled           └─(cronjob 00:05: đã qua ngày trả phòng)► Completed
                                                                                                                │
                                                                    khách viết đánh giá 1–5 sao (1 lần / đơn) ◄─┘
```

- **Hủy / hết hạn** (`cancelPendingBooking`):
  - Dùng `findOneAndUpdate { bookingStatus: Pending }`. Tiến trình nào thắng (khách, cronjob, trang thanh toán) thì tiến trình đó mới hoàn quỹ phòng và trả lượt mã giảm giá, nên không hoàn 2 lần.
  - Chủ khách sạn nhận thông báo.
- **Đánh giá** — `POST /api/reviews`:
  - Chỉ nhận đơn `Completed` của chính khách, mỗi đơn 1 lần, nội dung 5–1000 ký tự.
  - Sau đó tính lại `hotels.rating` và `reviewCount` (dùng để xếp hạng khách sạn nổi bật).

### 2.8 Xe đưa đón: tìm, đặt, thanh toán

Cùng khuôn mẫu với đặt phòng. Đơn vị giữ chỗ là **số xe trống theo ngày** (`vehicleinventories`) thay vì số phòng theo đêm.

```
Tìm xe (GET /api/transfers/search?province=|hotelId=&date=&passengers=, công khai)
  ├─(1) Tuyến của nhà xe ĐÃ DUYỆT, loại xe và tuyến đang hoạt động, đúng tỉnh
  ├─(2) Số xe cần = ⌈số khách / số chỗ của xe⌉
  ├─(3) Có ngày → chỉ giữ tuyến còn đủ xe trong ngày đó
  └─(4) Sắp xếp rẻ nhất trước   (cùng hàm transferService.findTransferOptions với chatbot)

Đặt xe (POST /api/transfers + Idempotency-Key)
  { routeId, pickupTime, passengers, contactPhone, flightNumber?, hotelBookingId? }
  ├─(1) Trừ số xe trống của ngày đón (giờ VN) bằng lệnh có điều kiện
  └─(2) Tạo transferbookings: status = Pending, giữ xe 5 phút

Mã giảm giá / thanh toán / hủy / hết hạn → giống 2.5 – 2.7 (dùng transferBookingId)
Hoàn thành → nhà xe bấm "Đã đón khách", hoặc cronjob khi đã qua giờ đón
```

Trang chi tiết khách sạn, trang thanh toán thành công và lịch sử đặt phòng có lối tắt "Đặt xe đưa đón", tự điền sẵn tỉnh và ngày.

### 2.9 Tài khoản, yêu thích, thông báo

```
Hồ sơ          GET / PUT /api/users/me            họ tên, SĐT, địa chỉ (tỉnh thuộc 63 tỉnh)
Đổi mật khẩu   PUT /api/users/me/password         phải nhập đúng mật khẩu cũ

Yêu thích      POST / DELETE /api/users/me/wishlist/:hotelId → users.wishlist (tối đa 200 khách sạn)
               GET /api/users/me/wishlist → chỉ hiện khách sạn còn Approved
               (trạng thái trái tim dùng chung mọi trang: hooks/useWishlist.js)

Thông báo      chuông trên header: GET /api/notifications mỗi 60 giây và khi quay lại tab
               đánh dấu đọc: PUT /api/notifications/:id/read, PUT /api/notifications/read-all
               backend tự tạo khi có sự kiện (services/notificationService.js); tự xóa sau 90 ngày
```

### 2.10 Đăng ký làm đối tác / nhà xe

```
Làm đối tác khách sạn  POST /api/partner/apply     → users.partnerApplicationStatus = Pending
                       GET /api/partner/application-status (theo dõi)  → Admin duyệt (mục 5.1)

Làm nhà xe             POST /api/transport/apply   { tên, SĐT, số giấy phép, các tỉnh phục vụ }
                       → transportcompanies: status = Pending              → Admin duyệt (mục 5.1)
```

---

## 3. Đối tác khách sạn (Partner)

Có được vai trò này sau khi Admin duyệt hồ sơ. Mọi API ghi dữ liệu đều kiểm tra **sở hữu** (`ownsHotelParam`, `ownsRoomParam`, `ownsRoomBody`), nên đối tác chỉ thao tác được trên khách sạn và phòng của mình.

### 3.1 Tạo và sửa khách sạn

```
Tạo khách sạn (POST /api/partner/hotels)
  ├─(1) Kiểm tra dữ liệu; tỉnh phải thuộc 63 tỉnh ("Huế" tự chuẩn hóa thành "Thừa Thiên Huế")
  ├─(2) Lưu hotels: status = Pending, embedding rỗng
  └─(3) Thông báo Admin "hồ sơ mới chờ duyệt"

Admin duyệt (mục 5.1)
  ├─ Approved → tạo vector bge-m3 qua Ollama → khách sạn hiện trên web và trong chatbot
  └─ Rejected (kèm lý do) → Partner nhận thông báo, thấy lý do

Sửa khách sạn (PUT /api/partner/hotels/:hotelId)
  ├─ Khách sạn đang Rejected → tự gửi duyệt lại (status = Pending)
  ├─ Đổi tên / mô tả / tiện nghi / địa chỉ → tạo lại vector ở nền (không bắt khách chờ)
  └─ Chỉ đổi ảnh → không tạo lại vector
```

### 3.2 Hạng phòng và quỹ phòng theo ngày

```
Tạo hạng phòng   POST /api/partner/hotels/:hotelId/rooms
                 tên, mô tả, giá gốc, sức chứa, tổng số phòng, tiện nghi, ảnh
                 → KHÔNG cần tạo lại vector (vector ở cấp khách sạn), chatbot thấy phòng mới ngay

Sửa / khóa       PUT /api/partner/rooms/:roomId,  PUT /api/partner/rooms/:roomId/toggle
                 isActive = false → hạng phòng biến khỏi tìm kiếm và chatbot

Giá + số phòng   PUT /api/partner/inventory { roomTypeId, startDate, endDate, newPrice?, newQuantity? }
theo ngày        → ghi roominventories từng đêm (dynamicPrice, availableRooms)
                 xem lại: GET /api/partner/inventory/check/:roomId?startDate=&endDate=
```

### 3.3 Đơn đặt phòng của khách sạn

```
GET /api/partner/bookings?status=
  → đơn của các khách sạn mình sở hữu + thống kê khách sắp nhận / trả phòng (chỉ tính đơn Confirmed)

PUT /api/partner/bookings/:id/complete
  → chỉ chuyển được Confirmed → Completed (khách đã trả phòng); sau bước này khách mới đánh giá được
```

### 3.4 Mã giảm giá của khách sạn

```
GET / POST / PUT / DELETE /api/coupons
  ├─ Partner chỉ tạo mã gắn với MỘT khách sạn của mình đã được duyệt (ownerRole = Partner, hotelId)
  ├─ Mã của Partner chỉ dùng cho đặt phòng (appliesTo = hotel)
  └─ Thấy số lượt đã dùng; cách khách dùng mã xem mục 2.5
```

### 3.5 Thống kê

```
GET /api/partner/stats?months=   — services/statsService.js (tính theo tháng, giờ VN)
  ├─ Doanh thu       = tổng giao dịch Success của các khách sạn mình
  ├─ Số đơn
  └─ Tỷ lệ lấp phòng = đêm-phòng đã bán / đêm-phòng có thể bán
Hiển thị: biểu đồ cột (có nút "Xem dạng bảng") + bảng lấp phòng theo từng khách sạn
```

---

## 4. Nhà xe (Transport)

Có được vai trò này sau khi Admin duyệt hồ sơ nhà xe. API kiểm tra vai trò `Transport`, nhà xe đã được duyệt (`requireApprovedCompany`), và quyền sở hữu loại xe / tuyến (`ownsVehicle`, `ownsRoute`).

```
Hồ sơ nhà xe     GET / PUT /api/transport/my-company        (tỉnh phục vụ thuộc 63 tỉnh)

Thêm loại xe     POST /api/transport/vehicles
                 số chỗ, số vali, tổng số xe, tiện nghi, ảnh
                 → tự tạo lịch 60 ngày tới: vehicleinventories.availableVehicles = tổng số xe

Thêm tuyến       POST /api/transport/vehicles/:vehicleId/routes
                 tỉnh, điểm đón → điểm trả, giá trọn gói / xe, thời gian đi
                 → tuyến hiện ở trang Xe đưa đón và trong chatbot

Số xe trống      GET / PUT /api/transport/vehicles/:vehicleId/inventory   (chỉnh theo khoảng ngày)

Ẩn xe / tuyến    PUT /vehicles/:vehicleId hoặc PUT /routes/:routeId với isActive = false
                 → không còn xuất hiện khi khách tìm

Đơn đặt xe       GET /api/transport/bookings → đơn + thống kê
                 PUT /api/transport/bookings/:id/complete → "Đã đón khách" (Confirmed → Completed)
```

Khi khách thanh toán xong đơn xe, nhà xe nhận thông báo "đơn mới". Doanh thu xe được Admin thống kê chung (mục 5.3).

---

## 5. Quản trị viên (Admin)

Trang `/admin` có các tab (lưu trên URL `?tab=`), cùng trang `/admin/rag`. Mọi API kiểm tra vai trò `Admin`.

### 5.1 Duyệt hồ sơ

| Hồ sơ | API | Kết quả |
|---|---|---|
| Đối tác | `GET /api/partner/applications/pending`, `PUT /api/partner/applications/:userId/approve\|reject` | Duyệt → `role = Partner`; từ chối → giữ `Customer`. Người nộp nhận thông báo |
| Khách sạn | `GET /api/admin/hotels?status=`, `PUT /api/admin/hotels/:id/status {status, reason?}` | `Approved` → tạo vector `bge-m3` (Ollama lỗi thì vẫn duyệt, vector tạo lại sau bằng `seedMockData.js --embeddings`); `Rejected` → lưu lý do. Partner nhận thông báo |
| Nhà xe | `GET /api/admin/transport-companies?status=`, `PUT /api/admin/transport-companies/:id/status` | `Approved` → `role = Transport`; gỡ duyệt / từ chối → trả về `Customer`. Chủ nhà xe nhận thông báo |

Khi có hồ sơ mới chờ duyệt, Admin nhận thông báo trên chuông.

### 5.2 Quản lý người dùng

```
GET /api/admin/users?search=&role=&status=   tìm theo tên đăng nhập / tên / email / SĐT
PUT /api/admin/users/:userId/status { status: Locked | Active }
  ├─ Tài khoản Locked không đăng nhập được
  ├─ Token đang dùng cũng bị chặn ngay (authenticateUser đọc lại trạng thái từ DB mỗi request)
  └─ Admin không tự khóa được chính mình
```

### 5.3 Mã giảm giá toàn sàn, thống kê, xuất báo cáo

```
Mã toàn sàn     POST /api/coupons với ownerRole = Admin; phạm vi phòng / xe / cả hai; áp mọi khách sạn

Thống kê        GET /api/admin/stats?months=
                doanh thu phòng + xe theo tháng, số đơn, tỷ lệ lấp phòng toàn sàn

Xuất báo cáo    GET /api/admin/reports/export?format=xlsx|csv&type=hotel|transfer|monthly&from=&to=
                ├─ Excel: exceljs, 3 sheet (doanh thu theo tháng, đơn phòng, đơn xe)
                ├─ CSV: UTF-8 có BOM (Excel đọc đúng tiếng Việt), chặn CSV injection
                └─ tên file gửi qua header Content-Disposition (CORS cho phép frontend đọc)
```

### 5.4 Đánh giá chatbot (RAG Analytics)

```
Mỗi câu hỏi gửi chatbot → 1 bản ghi raglogs
  │
  ├─ npm run rag:replay  → gửi bộ câu hỏi mẫu (golden_dataset.json), gắn nhãn đáp án chuẩn
  │
  ├─ GET /api/admin/rag-analytics
  │      HitRate, Recall@K, Precision@K, nDCG, MRR, tỷ lệ trích dẫn đúng [n],
  │      tỷ lệ từ chối, độ trễ   (services/ragMetrics.js)
  │
  └─ POST /api/admin/rag/evaluate
         Groundedness: model Ollama chấm câu trả lời có bám dữ liệu đã truy xuất không (1 / 0)
```

---

## 6. Tác vụ chạy nền (cronjob)

`jobs/bookingCron.js` (node-cron, múi giờ `Asia/Ho_Chi_Minh`) chạy cùng server:

```
Mỗi phút — releaseExpiredBookings
  ├─ Đơn phòng / đơn xe Pending đã quá expiresAt → Canceled
  ├─ Hoàn quỹ phòng / quỹ xe, trả lượt mã giảm giá
  ├─ Thông báo chủ khách sạn / nhà xe "đơn tự hủy do quá hạn"
  └─ Có cờ chống chạy chồng (lần trước chưa xong thì bỏ qua lần này)

00:05 hằng ngày — completeFinishedStays
  ├─ Đơn phòng Confirmed đã qua ngày trả phòng → Completed (khách được đánh giá)
  └─ Đơn xe Confirmed đã qua giờ đón → Completed
```

---

## 7. Bảng tra nhanh: use case → API → file

| Vai trò | Use case | API chính | File backend |
|---|---|---|---|
| Khách | Đăng ký / xác nhận / đăng nhập / quên MK | `/api/auth/*` | `controllers/authController.js`, `services/mailService.js` |
| Khách | Tìm, xem khách sạn | `/api/hotels/*`, `/api/reviews/hotel/:id` | `controllers/hotelController.js` |
| Khách | Chatbot phòng + xe | `POST /api/ai/search` | `controllers/aiController.js`, `services/{queryConstraintParser,ragRetrieval,llmService,transferService}.js` |
| Khách | Đặt / hủy phòng | `/api/bookings` | `controllers/bookingController.js`, `services/inventoryService.js` |
| Khách | Mã giảm giá | `/api/bookings/:id/coupon`, `/api/transfers/:id/coupon`, `/api/coupons/available` | `controllers/couponController.js`, `services/couponService.js` |
| Khách | Thanh toán VNPay | `/api/payments/vnpay/*` | `controllers/paymentController.js` |
| Khách | Đánh giá | `POST /api/reviews` | `controllers/reviewController.js` |
| Khách | Xe đưa đón | `/api/transfers/*` | `controllers/transferController.js`, `services/transferService.js` |
| Khách | Hồ sơ, yêu thích | `/api/users/me*` | `controllers/{userController,wishlistController}.js` |
| Mọi vai trò | Thông báo | `/api/notifications*` | `controllers/notificationController.js`, `services/notificationService.js` |
| Partner | Khách sạn, phòng, quỹ phòng, đơn | `/api/partner/*` | `controllers/partnerController.js`, `middleware/ownershipMiddleware.js` |
| Partner | Thống kê | `GET /api/partner/stats` | `services/statsService.js` |
| Nhà xe | Loại xe, tuyến, số xe trống, đơn | `/api/transport/*` | `controllers/transportController.js`, `middleware/transportOwnership.js` |
| Admin | Duyệt hồ sơ, người dùng | `/api/admin/*`, `/api/partner/applications/*` | `controllers/{adminController,partnerController,transportController}.js`, `services/aiService.js` |
| Admin | Thống kê, xuất báo cáo | `/api/admin/stats`, `/api/admin/reports/export` | `services/statsService.js`, `controllers/reportController.js` |
| Admin | RAG Analytics | `/api/admin/rag-analytics`, `/api/admin/rag/evaluate` | `controllers/adminController.js`, `services/ragMetrics.js` |
| Hệ thống | Hủy đơn quá hạn, hoàn thành đơn | — | `jobs/bookingCron.js` |
