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
| `GET /api/hotels`, `/hotels/search`, `/hotels/amenities`, `/hotels/:id`, `/hotels/:id/rooms`, `GET /api/reviews/hotel/:id`, `POST /api/ai/search` | 🌐 | 🌐 | 🌐 | 🌐 |
| `POST /api/auth/register`, `/auth/login` | 🌐 | 🌐 | 🌐 | 🌐 |
| `GET/PUT /api/users/me`, `PUT /users/me/password` | ❌ | 🔒 | 🔒 | 🔒 |
| `POST /api/bookings`, `GET /bookings/my-bookings`, `GET /bookings/:id`, `PUT /bookings/:id/cancel` | ❌ | 🔒 | 🔒 | 🔒 |
| `POST /api/payments/vnpay/create_url` | ❌ | 🔒 đơn của mình | 🔒 | 🔒 |
| `POST /api/reviews` | ❌ | 🔒 đơn Completed của mình | 🔒 | 🔒 |
| `POST /api/partner/apply`, `GET /partner/application-status` | ❌ | ✅ | ✅ | ✅ |
| `POST /api/partner/hotels`, `GET /partner/hotels` | ❌ | ❌ | 🔒 | ✅ |
| `POST /partner/hotels/:hotelId/rooms`, `PUT /partner/hotels/:hotelId` | ❌ | ❌ | 🔒 KS của mình | ✅ |
| `PUT /partner/rooms/:roomId`, `PUT /partner/rooms/:roomId/toggle`, `PUT /partner/inventory`, `GET /partner/inventory/check/:roomId` | ❌ | ❌ | 🔒 phòng của mình | ✅ |
| `GET /partner/bookings`, `PUT /partner/bookings/:id/complete` | ❌ | ❌ | 🔒 đơn của KS mình | ✅ |
| `GET /partner/applications/pending`, `PUT /partner/applications/:userId/:decision` | ❌ | ❌ | ❌ | ✅ |
| `/api/admin/*` (users, hotels, rag-analytics, rag/evaluate) | ❌ | ❌ | ❌ | ✅ |
| `GET /api/payments/vnpay/return` | Xác thực bằng chữ ký HMAC-SHA512 của VNPay (sai chữ ký → 400) | | | |

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

## 5. Còn lại (chưa xử lý)

- `GET /api/hotels/:id` và `GET /api/hotels/:id/rooms?showAll=true` vẫn công khai cả khách sạn chưa duyệt / hạng phòng đang khóa (chỉ lộ thông tin mô tả, không sửa được).
- Chưa có giới hạn tần suất (rate limit) cho `/auth/login` và `/ai/search`.
