# Phân quyền phía server (RBAC + Ownership)

> Trả lời góp ý **#6 – RBAC/Ownership**. Mọi kiểm tra nằm ở backend; `ProtectedRoute` ở frontend chỉ để điều hướng giao diện.

## 1. Ba lớp kiểm tra

| Lớp | Code | Trả về khi vi phạm |
|---|---|---|
| Xác thực (JWT hợp lệ, tài khoản tồn tại, không bị khóa) | `middleware/authMiddleware.js` → `authenticateUser` | **401** |
| Vai trò (Customer / Partner / Admin) | `middleware/authMiddleware.js` → `authorizeRoles(...)` | **403** |
| Quyền sở hữu khách sạn / hạng phòng | `middleware/ownershipMiddleware.js` → `requireHotelOwnership`, `requireRoomOwnership` | **403** |
| Quyền sở hữu đơn / đánh giá / thanh toán | trong controller: lọc theo `customerId = req.user.id` hoặc so khớp `hotel.partnerId` | **403 / 404** |

Ngoài ra: tài khoản `Locked` không đăng nhập được (403) và token cũ bị từ chối (401).

## 2. Ma trận endpoint × vai trò

Ký hiệu: ✅ được phép · 🔒 chỉ trên tài nguyên **của mình** · ❌ bị chặn (401/403) · 🌐 công khai

| Endpoint | Khách vãng lai | Customer | Partner | Admin |
|---|---|---|---|---|
| `GET /api/transfers/provinces`, `/transfers/search` | 🌐 | 🌐 | 🌐 | 🌐 |
| `POST /api/transfers`, `GET /transfers/my`, `GET /transfers/:id`, `PUT /transfers/:id/cancel` | ❌ | 🔒 đơn xe của mình | 🔒 | 🔒 |
| `GET /api/transport/my-company`, `POST /transport/apply` | ❌ | ✅ (apply: chỉ Customer) | ❌ apply 409 | ❌ apply 409 |
| `PUT /transport/my-company`, `GET/POST /transport/vehicles`, `GET /transport/bookings`, `PUT /transport/bookings/:id/complete` | ❌ | ❌ | ❌ | ❌ — **chỉ role `Transport`** có hồ sơ `Approved`, 🔒 dữ liệu nhà xe mình |
| `PUT /transport/vehicles/:vehicleId`, `POST /transport/vehicles/:vehicleId/routes`, `PUT /transport/routes/:routeId`, `GET/PUT /transport/vehicles/:vehicleId/inventory` | ❌ | ❌ | ❌ | ✅ (Transport: 🔒 xe/tuyến của mình) |
| `GET /api/admin/transport-companies`, `PUT /admin/transport-companies/:id/status` | ❌ | ❌ | ❌ | ✅ |
| `GET /api/hotels`, `/hotels/search`, `/hotels/provinces`, `/hotels/amenities`, `/hotels/:id`, `/hotels/:id/rooms`, `GET /api/reviews/hotel/:id`, `POST /api/ai/search` | 🌐 | 🌐 | 🌐 | 🌐 |
| `POST /api/auth/register`, `/auth/login`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password` | 🌐 | 🌐 | 🌐 | 🌐 |
| `GET/PUT /api/users/me`, `PUT /users/me/password` | ❌ | 🔒 | 🔒 | 🔒 |
| `GET/POST/DELETE /api/users/me/wishlist[/:hotelId]` | ❌ | 🔒 của mình | 🔒 | 🔒 |
| `GET/PUT /api/notifications[...]` | ❌ | 🔒 thông báo của mình | 🔒 | 🔒 |
| `PUT/DELETE /api/bookings/:id/coupon`, `/transfers/:id/coupon` | ❌ | 🔒 đơn Pending của mình | 🔒 | 🔒 |
| `GET /api/coupons/available` | ❌ | ✅ | ✅ | ✅ |
| `GET/POST/PUT/DELETE /api/coupons[/:id]` | ❌ | ❌ | 🔒 mã của mình, chỉ cho KS của mình | ✅ |
| `GET /api/partner/stats` | ❌ | ❌ | 🔒 KS của mình | ✅ |
| `POST /api/bookings`, `GET /bookings/my-bookings`, `GET /bookings/:id`, `PUT /bookings/:id/cancel` | ❌ | 🔒 | 🔒 | 🔒 |
| `POST /api/payments/vnpay/create_url` | ❌ | 🔒 đơn của mình | 🔒 | 🔒 |
| `POST /api/reviews` | ❌ | 🔒 đơn Completed của mình | 🔒 | 🔒 |
| `POST /api/partner/apply`, `GET /partner/application-status` | ❌ | ✅ | ✅ | ✅ |
| `POST /api/partner/hotels`, `GET /partner/hotels` | ❌ | ❌ | 🔒 | ✅ |
| `POST /partner/hotels/:hotelId/rooms`, `PUT /partner/hotels/:hotelId` | ❌ | ❌ | 🔒 KS của mình | ✅ |
| `PUT /partner/rooms/:roomId`, `PUT /partner/rooms/:roomId/toggle`, `PUT /partner/inventory`, `GET /partner/inventory/check/:roomId` | ❌ | ❌ | 🔒 phòng của mình | ✅ |
| `GET /partner/bookings`, `PUT /partner/bookings/:id/complete` | ❌ | ❌ | 🔒 đơn của KS mình | ✅ |
| `GET /partner/applications/pending`, `PUT /partner/applications/:userId/:decision` | ❌ | ❌ | ❌ | ✅ |
| `/api/admin/*` (users, hotels, rag-analytics, rag/evaluate, stats, reports/export) | ❌ | ❌ | ❌ | ✅ |
| `GET /api/payments/vnpay/return` | Xác thực bằng chữ ký HMAC-SHA512 của VNPay (sai chữ ký → 400); số tiền phải khớp tổng tiền hiện tại của đơn | | | |

## 3. Lỗ hổng đã phát hiện và vá

| Trước | Sau |
|---|---|
| `PUT /partner/rooms/:roomId/toggle` chỉ cần đăng nhập → **Customer khóa được phòng của bất kỳ khách sạn nào** | Partner/Admin + sở hữu hạng phòng |
| `PUT /partner/inventory` không kiểm tra sở hữu → **Partner A sửa giá/quỹ phòng của Partner B** | `requireRoomOwnership` + validate ngày, giá > 0, số phòng 0..totalQuantity |
| `GET /partner/inventory/check/:roomId` mở cho mọi tài khoản | Partner/Admin + sở hữu |
| `POST /payments/vnpay/create_url` tạo link thanh toán cho đơn của người khác | Chỉ chủ đơn (403) |
| `POST /partner/hotels/:hotelId/rooms` chặn cả Admin | Admin được phép |
| Tài khoản bị khóa vẫn đăng nhập lấy token | Login trả 403 |

## 4. Minh chứng: negative API tests

`Hotel-RAG-BE/tests/rbac.test.js` — chạy `npm test` (xem README). Bao gồm:

- 401: không token, token giả mạo, tài khoản bị khóa.
- 403: Customer gọi 5 API Admin và các API Partner; Partner gọi API Admin.
- 403: Partner B thêm phòng / khóa phòng / sửa giá / xem quỹ / xem đơn / xác nhận trả phòng trên khách sạn của Partner A.
- Khách B không xem / hủy / thanh toán / đánh giá đơn của khách A.
- Positive: chủ khách sạn và Admin được phép; dữ liệu sai bị từ chối 400.

`Hotel-RAG-BE/tests/transfer.test.js` (xe đưa đón):

- 403: Customer quản lý xe / xem đơn nhà xe; nhà xe gọi API Admin.
- 403: Nhà xe B sửa loại xe, thêm/sửa tuyến, xem/sửa lịch xe, xác nhận đơn của nhà xe A.
- 404/403: khách khác hủy / thanh toán đơn xe; gắn đơn phòng của người khác.
- Đồng thời: còn 1 xe, 2 khách đặt cùng lúc → đúng 1 đơn; cùng `Idempotency-Key` → 1 đơn, trừ xe 1 lần.

## 5. Còn lại (chưa xử lý)

- `GET /api/hotels/:id` và `GET /api/hotels/:id/rooms?showAll=true` vẫn công khai cả khách sạn chưa duyệt / hạng phòng đang khóa (chỉ lộ thông tin mô tả, không sửa được).
- Chưa có giới hạn tần suất (rate limit) cho `/auth/login` và `/ai/search`.
