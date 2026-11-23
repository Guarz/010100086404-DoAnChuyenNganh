# Từ điển dữ liệu (Data Dictionary) — Hotel-RAG

Giải thích từng trường của các collection trong MongoDB (database `Hotel-RAG`). Định nghĩa gốc nằm trong `Hotel-RAG-BE/models/*.js`; sơ đồ quan hệ ở [`erd.mmd`](erd.mmd) / [`erd.png`](erd.png).

Quy ước:
- **Bắt buộc**: ✔ = Mongoose yêu cầu phải có giá trị.
- `_id` (ObjectId) là khóa chính do MongoDB tự sinh, có ở mọi collection nên không nhắc lại.
- Các collection có `timestamps: true` được Mongoose tự thêm `createdAt` (thời điểm tạo) và `updatedAt` (lần sửa cuối).

---

## 1. `users` — Tài khoản người dùng

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `fullName` | String | ✔ | | Họ tên hiển thị (tài khoản mới: mặc định bằng tên đăng nhập, sửa trong trang Tài khoản) |
| `username` | String | | **unique** (sparse), chữ thường, `^[a-z0-9._]{3,30}$` | Tên đăng nhập. Tài khoản cũ được seed tạo từ phần trước `@` của email |
| `email` | String | ✔ | index thường (không unique) | Email nhận thư xác nhận / đặt lại mật khẩu. **Một email được dùng cho nhiều tài khoản**; mỗi tài khoản phân biệt bằng `username` |
| `password` | String | ✔ | | Mật khẩu đã băm bằng bcrypt (không bao giờ lưu mật khẩu gốc, không trả về qua API) |
| `phone` | String | | | Số điện thoại liên hệ (dùng cho Partner liên lạc khách) |
| `role` | String | | `Customer` · enum: `Customer`, `Partner`, `Transport`, `Admin` | Vai trò, quyết định quyền truy cập API (RBAC) |
| `partnerApplicationStatus` | String | | `NotRequested` · enum: `NotRequested`, `Pending`, `Approved`, `Rejected` | Trạng thái đơn xin trở thành đối tác; Admin duyệt thì `role` đổi thành `Partner` |
| `status` | String | | `Active` · enum: `Active`, `Locked` | `Locked` = Admin khóa: không đăng nhập được, token cũ bị từ chối (401) |
| `emailVerified` | Boolean | | `false` khi vừa đăng ký (nếu bắt buộc xác nhận) | `false` = chưa bấm link xác nhận, chưa được đăng nhập (403). Tài khoản cũ không có trường này được coi là đã xác nhận |
| `emailVerifyTokenHash`, `emailVerifyExpires` | String, Date | | ẩn (`select: false`), hạn 24 giờ | SHA-256 của token trong link xác nhận email; xóa sau khi dùng |
| `resetPasswordTokenHash`, `resetPasswordExpires` | String, Date | | ẩn, hạn 30 phút | SHA-256 của token trong link đặt lại mật khẩu; dùng 1 lần |
| `lastVerifyMailAt`, `lastResetMailAt` | Date | | ẩn | Lần gửi email gần nhất theo từng loại, chặn gửi lại trong 60 giây |
| `address.street` / `.city` | String | | | Số nhà, đường / quận-huyện (object nhúng) |
| `address.province` | String | | 1 trong 63 tỉnh/thành ([danh mục](#danh-muc-63-tinh)) | Tỉnh/TP của người dùng; giá trị khác bị từ chối (400) |
| `wishlist` | [ObjectId → `hotels`] | | tối đa 200 | Khách sạn yêu thích (khách sạn ngừng duyệt tự ẩn khỏi danh sách) |
| `createdAt`, `updatedAt` | Date | | tự động | |

**Index:** `username` (unique, sparse), `email` (thường).

---

## 2. `hotels` — Khách sạn / chỗ nghỉ

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `partnerId` | ObjectId → `users` | ✔ | | Partner sở hữu khách sạn; dùng để kiểm tra quyền sở hữu khi sửa |
| `hotelName` | String | ✔ | | Tên khách sạn |
| `description` | String | ✔ | | Mô tả; là một phần nội dung tạo vector cho tìm kiếm AI |
| `address.street` | String | | | Số nhà, đường |
| `address.city` | String | | nhập tự do | Quận / huyện / thành phố thuộc tỉnh (vd. Đà Lạt, Hội An, Quận 1); RAG dùng để khớp địa danh |
| `address.province` | String | ✔ | 1 trong 63 tỉnh/thành ([danh mục](#danh-muc-63-tinh)) | Tỉnh/TP — trường dùng cho **bộ lọc khách sạn** (`?province=`) và gợi ý xe đưa đón. Cách viết khác ("Huế", "TP HCM") được tự chuẩn hóa |

**Index:** `{ address.province, status }` (lọc theo tỉnh).
| `coordinates` | GeoJSON `{ type: 'Point', coordinates: [lng, lat] }` | | không có thì bỏ trống (không lưu `{type}` rỗng) | Tọa độ bản đồ; có index `2dsphere` để truy vấn theo khoảng cách |
| `rating` | Number | | `0` | Điểm trung bình (1 chữ số thập phân), **tự tính lại** mỗi khi có review mới |
| `reviewCount` | Number | | `0` | Số lượt đánh giá; dùng làm trọng số khi hiển thị/xếp hạng |
| `amenities` | [String] | | | Tiện nghi cấp khách sạn (hồ bơi, spa…); được chuẩn hóa: bỏ trùng, tối đa 30 mục |
| `images` | [String] | | | URL ảnh (chỉ http/https, tối đa 20) |
| `embedding` | [Number] | | | Vector 1024 chiều (model `bge-m3` chạy bằng Ollama) của tên + mô tả + tiện nghi + địa chỉ; dùng cho xếp hạng ngữ nghĩa; không trả về qua API |
| `status` | String | | `Pending` · enum: `Pending`, `Approved`, `Rejected` | Chỉ khách sạn `Approved` hiển thị cho khách; Partner sửa KS bị từ chối thì tự quay về `Pending` |
| `rejectionReason` | String | | | Lý do Admin từ chối |
| `reviewedAt` | Date | | | Thời điểm Admin duyệt hoặc từ chối |
| `createdAt`, `updatedAt` | Date | | tự động | |

**Index:** `coordinates` (2dsphere). Xếp hạng ngữ nghĩa tính cosine trong ứng dụng; Atlas Search index `default` trên `embedding` chỉ dùng cho baseline của benchmark (đổi model thì sửa `dimensions` thành 1024).

---

## 3. `roomtypes` — Hạng phòng

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `hotelId` | ObjectId → `hotels` | ✔ | | Khách sạn chứa hạng phòng |
| `title` | String | ✔ | | Tên hạng phòng (vd. "Deluxe Hướng Biển") |
| `description` | String | | | Mô tả phòng (diện tích, view…) |
| `basePrice` | Number | ✔ | | Giá gốc mỗi đêm (VNĐ); dùng khi ngày đó chưa đặt giá động |
| `maxAdults` | Number | ✔ | | Số người lớn tối đa |
| `maxChildren` | Number | | `0` | Số trẻ em tối đa |
| `totalQuantity` | Number | ✔ | | Tổng số phòng vật lý của hạng này; đổi giá trị thì quỹ phòng từ hôm nay được cộng/trừ phần chênh lệch |
| `amenities` | [String] | | | Tiện nghi trong phòng (ban công, bồn tắm…); bộ lọc tiện nghi xét cả trường này |
| `images` | [String] | | | URL ảnh phòng |
| `isActive` | Boolean | | `true` | `false` = Partner khóa bảo trì: không hiển thị, không đặt được |
| `createdAt`, `updatedAt` | Date | | tự động | |

---

## 4. `roominventories` — Quỹ phòng và giá theo từng ngày

Mỗi document = **một hạng phòng trong một đêm**.

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `roomTypeId` | ObjectId → `roomtypes` | ✔ | | Hạng phòng |
| `date` | Date | ✔ | lưu mốc 00:00 UTC | Đêm lưu trú (đêm nhận phòng tính, đêm trả phòng không tính) |
| `availableRooms` | Number | ✔ | min 0 | Số phòng còn trống đêm đó; bị **trừ nguyên tử** khi khách đặt, cộng lại khi hủy / hết hạn thanh toán |
| `dynamicPrice` | Number | | null → dùng `basePrice` | Giá đêm đó (Partner chỉnh cho lễ, cuối tuần…) |
| `createdAt`, `updatedAt` | Date | | tự động | |

**Index:** `{ roomTypeId, date }` **unique** — một hạng phòng chỉ có một bản ghi mỗi đêm.

---

## 5. `bookings` — Đơn đặt phòng

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `customerId` | ObjectId → `users` | ✔ | | Người đặt; chỉ người này xem/hủy/thanh toán/đánh giá được đơn |
| `hotelId` | ObjectId → `hotels` | ✔ | | Khách sạn; Partner chủ KS xem được đơn |
| `checkInDate` | Date | ✔ | | Ngày nhận phòng (00:00 giờ Việt Nam) |
| `checkOutDate` | Date | ✔ | sau `checkInDate` | Ngày trả phòng |
| `expiresAt` | Date | | tạo đơn + 5 phút | Hạn giữ chỗ khi `Pending`; cronjob hủy đơn quá hạn và hoàn quỹ phòng; xóa khi đã thanh toán |
| `totalAmount` | Number | ✔ | | Số tiền phải trả = tạm tính − giảm giá |
| `subtotalAmount` | Number | | | Tạm tính trước giảm giá = Σ(giá từng đêm × số phòng); có khi đơn đã từng áp mã |
| `coupon.couponId` / `.code` / `.discountAmount` | ObjectId → `coupons`, String, Number | | | Mã giảm giá đang áp cho đơn (giữ 1 lượt dùng; trả lại khi đơn hủy / hết hạn / bỏ mã) |
| `specialRequests` | String | | | Yêu cầu đặc biệt của khách (tầng cao, giường phụ…) |
| `idempotencyKey` | String | | 8–100 ký tự | Khóa chống đặt trùng do frontend sinh; gửi lại cùng khóa → trả đơn cũ, không trừ quỹ lần 2 |
| `bookingStatus` | String | | `Pending` · enum: `Pending`, `Confirmed`, `Canceled`, `Completed` | `Pending` chờ thanh toán → `Confirmed` đã thanh toán → `Completed` đã trả phòng (mới được đánh giá); `Canceled` = hủy / hết hạn |
| `bookingDetails` | [BookingDetail] | | | Các hạng phòng trong đơn (mảng nhúng, xem dưới) |
| `createdAt`, `updatedAt` | Date | | tự động | `createdAt` chính là ngày đặt |

**`bookingDetails[]` (nhúng trong booking):**

| Trường | Kiểu | Bắt buộc | Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `roomTypeId` | ObjectId → `roomtypes` | ✔ | | Hạng phòng được đặt |
| `quantity` | Number | ✔ | min 1 | Số phòng của hạng này |
| `unitPrice` | Number | ✔ | | Giá gốc chốt tại thời điểm đặt (đổi giá sau không ảnh hưởng đơn cũ) |
| `totalNights` | Number | ✔ | | Số đêm |

**Index:** `{ bookingStatus, expiresAt }` (cronjob tìm đơn quá hạn), `{ hotelId, checkInDate }` (lịch nhận phòng của Partner), `{ customerId, idempotencyKey }` **unique** (chỉ áp cho đơn có khóa).

---

## 6. `payments` — Giao dịch thanh toán

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `bookingId` | ObjectId → `bookings` | ✔ nếu không có `transferBookingId` | | Đơn phòng được thanh toán (một đơn có thể có nhiều lần thử) |
| `transferBookingId` | ObjectId → `transferbookings` | | | Đơn xe đưa đón được thanh toán (dùng chung luồng VNPay; mỗi payment gắn đúng 1 trong 2 khóa) |
| `paymentMethod` | String | ✔ | enum: `VNPay`, `Momo`, `Cash`, `Demo` | Cổng / hình thức thanh toán (`Demo` là thanh toán mô phỏng ở giai đoạn đầu) |
| `amount` | Number | ✔ | | Số tiền (VNĐ) |
| `paymentStatus` | String | | `Pending` · enum: `Pending`, `Success`, `Failed` | Kết quả; VNPay mã `00` / MoMo `resultCode` 0 **và số tiền khớp đơn** → `Success` (đơn chuyển `Confirmed`), ngược lại → `Failed` |
| `paymentDate` | Date | | | Thời điểm thanh toán thành công |
| `transactionId` | String | | | Mã giao dịch của cổng thanh toán (`vnp_TransactionNo` / `transId` MoMo) để đối soát |
| `createdAt`, `updatedAt` | Date | | tự động | |

---

## 7. `reviews` — Đánh giá khách sạn

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `customerId` | ObjectId → `users` | ✔ | | Người viết (phải là chủ đơn) |
| `hotelId` | ObjectId → `hotels` | ✔ | | Khách sạn được đánh giá |
| `bookingId` | ObjectId → `bookings` | ✔ | **unique** | Đơn đã `Completed`; mỗi đơn chỉ đánh giá 1 lần |
| `rating` | Number | ✔ | 1–5, số nguyên | Số sao |
| `comment` | String | ✔ | 5–1000 ký tự | Nội dung nhận xét |
| `createdAt`, `updatedAt` | Date | | tự động | |

**Index:** `bookingId` (unique).

---

## 8. `raglogs` — Nhật ký trợ lý RAG

Mỗi document = **một câu hỏi** gửi tới `POST /api/ai/search`; dùng để đánh giá chất lượng RAG.

| Trường | Kiểu | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|---|
| `userQuery` | String | ✔ | | Câu hỏi của khách |
| `constraints` | Mixed (object) | | | Ràng buộc cứng tách được: `city`, `province` (tỉnh, kể cả suy từ địa danh / tên sân bay), `checkIn`, `checkOut`, `adults`, `children`, `rooms`, `minPrice`, `maxPrice`, `amenities`, `roomKinds`, `sortByPrice`, `offTopic`, `isHotelQuery`, `isTransferQuery` (có hỏi xe đưa đón), `transferDirection` (`fromAirport` / `toAirport` / null) |
| `retrievedHotelIds` | [ObjectId → `hotels`] | | | Khách sạn chứa các phòng được truy xuất |
| `retrievedContextIds` | [ObjectId → `roomtypes`] | | | Hạng phòng được truy xuất, **theo thứ tự xếp hạng** (dùng tính HitRate, Recall@K, Precision@K, nDCG@K, MRR) |
| `retrievedTransferRouteIds` | [ObjectId → `transferroutes`] | | | Tuyến xe đưa đón chatbot đã gợi ý (trích dẫn `[X1]`, `[X2]`...); rỗng nếu câu hỏi không hỏi xe |
| `goldenContextIds` | [ObjectId → `roomtypes`] | | | Nhãn đáp án chuẩn từ `golden_dataset.json` (gắn bằng `npm run rag:replay`) |
| `llmResponse` | String | ✔ | | Câu trả lời gửi cho khách |
| `answerSource` | String | | enum: `llm`, `template`, `guardrail` | `llm` = model sinh; `template` = model lỗi, trả lời dựng từ dữ liệu; `guardrail` = câu ngoài phạm vi bị từ chối |
| `llmModel` | String | | | Model đã trả lời, dạng `provider:model` (vd. `ollama:dolphin3`; log cũ trước 23/11/2026 có thể là `gemini:...`) |
| `pipelineStats` | Mixed (object) | | | Số ứng viên qua từng bước: `catalog` → `afterHardFilters` → `afterAvailability`, `semanticRanking` (có dùng vector không), `transferResults` (số tuyến xe gợi ý) |
| `latencyMs` | Number | | | Thời gian xử lý (ms) |
| `metrics.hitRate` / `.recall` / `.precision` | Number | | null | Chỉ số truy xuất (dự phòng; trang Analytics tính trực tiếp từ các trường ID ở trên) |
| `metrics.groundedness` | Number | | null | 1 = câu trả lời bám sát ngữ cảnh, 0 = có bịa (chấm bằng LLM-as-judge ở Admin → RAG Analytics) |
| `metrics.citationCorrectness` | Number | | null | Tỉ lệ trích dẫn `[n]` trỏ đúng ngữ cảnh đã truy xuất |
| `createdAt` | Date | | `Date.now` | Thời điểm hỏi |

---

## 9. `transportcompanies` — Hồ sơ nhà xe

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `ownerId` | ObjectId → `users` | ✔ | **unique** | Tài khoản chủ nhà xe (role `Transport` sau khi được duyệt) |
| `companyName` | String | ✔ | 2–150 ký tự | Tên nhà xe hiển thị cho khách |
| `phone` | String | ✔ | `^0\d{9,10}$` | Số điện thoại tổng đài |
| `licenseNumber` | String | ✔ | | Số giấy phép kinh doanh vận tải (Admin kiểm tra khi duyệt) |
| `description` | String | | ≤ 2000 ký tự | Giới thiệu |
| `serviceProvinces` | [String] | | ≥ 1, mỗi giá trị thuộc 63 tỉnh | Tỉnh/thành phục vụ; tuyến xe chỉ được mở trong các tỉnh này |
| `status` | String | | `Pending` · enum: `Pending`, `Approved`, `Rejected` | Trạng thái duyệt; chỉ `Approved` mới được bán xe |
| `rejectionReason` | String | | | Lý do từ chối (hiện cho chủ nhà xe) |
| `reviewedAt` | Date | | | Lúc Admin duyệt / từ chối |
| `createdAt`, `updatedAt` | Date | | tự động | |

---

## 10. `vehicletypes` — Loại xe của nhà xe

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `companyId` | ObjectId → `transportcompanies` | ✔ | | Nhà xe sở hữu |
| `name` | String | ✔ | | VD: "Sedan 4 chỗ", "Ford Transit 16 chỗ" |
| `seats` | Number | ✔ | min 1 | Số chỗ ngồi; số xe cần = ⌈số khách / seats⌉ |
| `luggage` | Number | | 0 | Số vali chở được |
| `totalVehicles` | Number | ✔ | min 1 | Tổng số xe loại này; đổi số này sẽ cộng/trừ chênh lệch vào lịch từ hôm nay |
| `amenities` | [String] | | | Tiện nghi trên xe |
| `images` | [String] | | URL http(s) | Ảnh xe |
| `isActive` | Boolean | | `true` | `false` = tạm ẩn, khách không tìm thấy |

---

## 11. `transferroutes` — Tuyến đưa đón

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `vehicleTypeId` | ObjectId → `vehicletypes` | ✔ | | Loại xe chạy tuyến |
| `companyId` | ObjectId → `transportcompanies` | ✔ | | Nhà xe (lưu thừa để lọc / kiểm tra sở hữu nhanh) |
| `province` | String | ✔ | 1 trong 63 tỉnh/thành, phải nằm trong `serviceProvinces` của nhà xe | Tỉnh/TP của tuyến; khớp `hotels.address.province` để gợi ý xe ở trang khách sạn |
| `fromPlace`, `toPlace` | String | ✔ | | Điểm đón / điểm trả |
| `price` | Number | ✔ | 10.000–50.000.000 | Giá trọn gói **mỗi xe mỗi chuyến** (VNĐ) |
| `durationMin` | Number | | 30 | Thời gian di chuyển ước tính (phút) |
| `isActive` | Boolean | | `true` | Tạm ngưng tuyến |

**Index:** `{ province, isActive }`.

---

## 12. `vehicleinventories` — Số xe trống theo ngày

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `vehicleTypeId` | ObjectId → `vehicletypes` | ✔ | | Loại xe |
| `date` | Date | ✔ | 00:00 UTC | Ngày phục vụ (theo lịch Việt Nam) |
| `availableVehicles` | Number | ✔ | min 0 | Số xe còn nhận đơn; trừ bằng `$inc` có điều kiện `>= số xe cần` (chống đặt vượt) |

**Index:** `{ vehicleTypeId, date }` **unique**. Tạo loại xe sẽ tự mở 60 ngày.

---

## 13. `transferbookings` — Đơn đặt xe đưa đón

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `customerId` | ObjectId → `users` | ✔ | | Khách đặt |
| `companyId` | ObjectId → `transportcompanies` | ✔ | | Nhà xe nhận đơn |
| `routeId` | ObjectId → `transferroutes` | ✔ | | Tuyến |
| `vehicleTypeId` | ObjectId → `vehicletypes` | ✔ | | Loại xe |
| `hotelBookingId` | ObjectId → `bookings` | | phải là đơn của chính khách | Đơn phòng đi kèm (đặt xe từ trang thanh toán / lịch sử đặt phòng) |
| `pickupTime` | Date | ✔ | ≥ hiện tại + 1 giờ | Giờ đón (khách nhập giờ Việt Nam) |
| `serviceDate` | Date | ✔ | 00:00 UTC | Ngày đón — khóa để trừ `vehicleinventories` |
| `passengers` | Number | ✔ | 1–100 | Số khách |
| `vehicles` | Number | | 1 | Số xe = ⌈passengers / seats⌉ |
| `flightNumber` | String | | ≤ 20 ký tự | Số hiệu chuyến bay (đón sân bay) |
| `contactPhone` | String | ✔ | `^0\d{9,10}$` | SĐT để tài xế liên hệ |
| `note` | String | | ≤ 500 ký tự | Ghi chú cho tài xế |
| `unitPrice` | Number | ✔ | | Giá tuyến tại thời điểm đặt |
| `totalAmount` | Number | ✔ | | Số tiền phải trả = `unitPrice × vehicles` − giảm giá |
| `subtotalAmount`, `coupon` | | | | Giống `bookings`: tạm tính và mã giảm giá đang áp |
| `status` | String | | `Pending` · enum: `Pending`, `Confirmed`, `Canceled`, `Completed` | Vòng đời: giữ xe → thanh toán VNPay → nhà xe xác nhận đã đón (hoặc cronjob tự `Completed` sau ngày đón) |
| `expiresAt` | Date | | | Hạn giữ xe 5 phút; cronjob hủy và trả xe khi quá hạn |
| `idempotencyKey` | String | | | Khóa chống gửi trùng (header `Idempotency-Key`) |

**Index:** `{ status, expiresAt }`, `{ companyId, pickupTime }`, `{ customerId, idempotencyKey }` **unique** (partial).

---

## 14. `coupons` — Mã giảm giá

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `code` | String | ✔ | **unique**, chữ hoa, `^[A-Z0-9_-]{3,30}$` | Mã khách nhập |
| `description` | String | | ≤ 200 ký tự | Mô tả ưu đãi |
| `discountType` | String | ✔ | enum: `percent`, `amount` | Giảm theo % hoặc số tiền cố định |
| `value` | Number | ✔ | % 1–100 hoặc ≥ 1.000₫ | Mức giảm |
| `maxDiscount` | Number | | | Giảm tối đa (mã %) |
| `minOrderAmount` | Number | | `0` | Giá trị đơn tối thiểu |
| `appliesTo` | String | | `hotel` · enum: `hotel`, `transfer`, `all` | Loại đơn áp dụng (mã của Partner luôn là `hotel`) |
| `hotelId` | ObjectId → `hotels` | | | Mã của Partner chỉ dùng cho khách sạn này; không có = mã toàn sàn |
| `createdBy`, `ownerRole` | ObjectId → `users`, String | ✔ | `ownerRole`: `Admin` / `Partner` | Người tạo; Partner chỉ thấy / sửa mã của mình |
| `startsAt`, `expiresAt` | Date | | | Thời gian hiệu lực |
| `usageLimit`, `usedCount` | Number | | `usedCount` 0 | Tổng lượt dùng / đã dùng (tăng nguyên tử khi áp mã, giảm khi đơn hủy / bỏ mã) |
| `perUserLimit` | Number | | `1` | Số đơn (chưa hủy) mỗi khách được dùng mã |
| `isActive` | Boolean | | `true` | Tắt mã mà không xóa (mã đã có người dùng không xóa được) |

Số tiền sau giảm luôn ≥ 10.000₫ (giới hạn của cổng thanh toán).

**Index:** `code` (unique), `{ createdBy, createdAt }`, `{ hotelId, isActive }`.

---

## 15. `notifications` — Thông báo trong trang

| Trường | Kiểu | Bắt buộc | Mặc định / Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `userId` | ObjectId → `users` | ✔ | | Người nhận |
| `type` | String | ✔ | enum: `order_new`, `order_paid`, `order_canceled`, `order_expired`, `application_approved`, `application_rejected`, `application_submitted` | Loại sự kiện |
| `title`, `message` | String | ✔ / | ≤ 150 / ≤ 500 ký tự | Nội dung hiển thị |
| `link` | String | | | Trang mở ra khi bấm thông báo |
| `readAt` | Date | | | Thời điểm đã đọc (không có = chưa đọc) |
| `createdAt`, `updatedAt` | Date | | tự động | |

**Sự kiện tạo thông báo:** thanh toán thành công (chủ KS / nhà xe: đơn mới; khách: đặt thành công), khách tự hủy đơn (chủ KS / nhà xe), cron hủy đơn quá hạn (khách), Admin duyệt / từ chối khách sạn, đơn đối tác, hồ sơ nhà xe (người gửi), hồ sơ mới chờ duyệt (mọi Admin).

**Index:** `{ userId, createdAt }`, TTL 90 ngày trên `createdAt` (tự xóa thông báo cũ).

---

<a id="danh-muc-63-tinh"></a>
## Phụ lục: Danh mục cố định 63 tỉnh/thành

Nguồn duy nhất: `Hotel-RAG-BE/constants/provinces.js` (bản sao giống hệt cho giao diện: `Hotel-RAG-FE/src/constants/provinces.js`, test `tests/provinces.test.js` kiểm tra 2 bản khớp nhau). Sắp xếp A→Z theo bảng chữ cái tiếng Việt. Người dùng **không nhập tay**: mọi form và bộ lọc dùng ô chọn từ danh sách này.

An Giang · Bà Rịa - Vũng Tàu · Bạc Liêu · Bắc Giang · Bắc Kạn · Bắc Ninh · Bến Tre · Bình Dương · Bình Định · Bình Phước · Bình Thuận · Cà Mau · Cao Bằng · Cần Thơ · Đà Nẵng · Đắk Lắk · Đắk Nông · Điện Biên · Đồng Nai · Đồng Tháp · Gia Lai · Hà Giang · Hà Nam · Hà Nội · Hà Tĩnh · Hải Dương · Hải Phòng · Hậu Giang · Hòa Bình · Hồ Chí Minh · Hưng Yên · Khánh Hòa · Kiên Giang · Kon Tum · Lai Châu · Lạng Sơn · Lào Cai · Lâm Đồng · Long An · Nam Định · Nghệ An · Ninh Bình · Ninh Thuận · Phú Thọ · Phú Yên · Quảng Bình · Quảng Nam · Quảng Ngãi · Quảng Ninh · Quảng Trị · Sóc Trăng · Sơn La · Tây Ninh · Thái Bình · Thái Nguyên · Thanh Hóa · Thừa Thiên Huế · Tiền Giang · Trà Vinh · Tuyên Quang · Vĩnh Long · Vĩnh Phúc · Yên Bái

API chấp nhận cả cách viết khác và địa danh quen thuộc rồi quy về tên chuẩn (vd. "TP HCM", "Sài Gòn" → Hồ Chí Minh; "Huế" → Thừa Thiên Huế; "Đà Lạt" → Lâm Đồng; "Hội An" → Quảng Nam; "Phú Quốc" → Kiên Giang). Giá trị không nhận ra → 400.
