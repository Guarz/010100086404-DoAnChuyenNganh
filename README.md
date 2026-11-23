# Nestly - Hotel Booking AI

Đồ án website đặt phòng khách sạn có trợ lý tìm kiếm bằng RAG. Frontend dùng React/Vite, API dùng Express/Mongoose và dữ liệu lưu trên MongoDB.

## Công nghệ và công cụ

- Node.js 20.19+ hoặc 22.12+ (khuyến nghị Node.js 22 LTS trở lên).
- npm.
- MongoDB Atlas với quyền đọc/ghi database.
- Ollama (máy cá nhân hoặc Google Colab) chạy `dolphin3` (viết câu trả lời) và `bge-m3` (tạo vector tìm kiếm). Hệ thống không dùng Gemini.
- Visual Studio Code.

### VS Code extensions (không bắt buộc)

Các extension này giúp viết code thuận tiện hơn, nhưng không thay thế Node.js/npm và không bắt buộc để chạy ứng dụng:

- **ESLint** (`dbaeumer.vscode-eslint`): xem lỗi lint trong editor.
- **Prettier - Code formatter** (`esbenp.prettier-vscode`): định dạng code.
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`): gợi ý class Tailwind.
- **MongoDB for VS Code** (`mongodb.mongodb-vscode`): xem/kết nối MongoDB từ VS Code.

## Cài đặt lần đầu

Mở thư mục dự án `010100086404-DoAnChuyenNganh` trong VS Code bằng **File → Open Folder...**. Mở Terminal tích hợp (**Terminal → New Terminal**) và chạy các lệnh sau từ thư mục gốc:

```powershell
npm install
cd .\Hotel-RAG-BE
npm install
cd ..\Hotel-RAG-FE
npm install
cd ..
```

Chạy `npm install` trong `Hotel-RAG-BE` để cài các package backend như `bcryptjs` và `jsonwebtoken`. **Không chạy `npm start` trong thư mục này**: package ở đó là Express scaffold cũ; API đang dùng được khởi chạy bằng `server.js` ở thư mục gốc.

## Cấu hình môi trường

Tạo hoặc cập nhật file `.env` ở **thư mục gốc**, cùng cấp với `server.js`. Không đưa file này lên GitHub và không chia sẻ giá trị thật của các khóa.

```env
PORT=5000
MONGO_URI=<chuoi-ket-noi-mongodb>
JWT_SECRET=<chuoi-bi-mat-dai-va-ngau-nhien>
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=dolphin3
OLLAMA_EMBED_MODEL=bge-m3
```

- `MONGO_URI`: connection string MongoDB Atlas, có tên database, ví dụ `Hotel-RAG`.
- `JWT_SECRET`: chuỗi bí mật do bạn tự tạo, dùng để ký/xác minh token đăng nhập.
- AI chạy hoàn toàn bằng Ollama: `OLLAMA_MODEL=dolphin3` viết câu trả lời, `OLLAMA_EMBED_MODEL=bge-m3` tạo vector cho khách sạn và câu hỏi (cài `ollama pull dolphin3` và `ollama pull bge-m3`, hoặc chạy trên Colab: [`docs/colab-ollama.md`](docs/colab-ollama.md)). Ollama chưa chạy thì chatbot vẫn hoạt động: xếp hạng theo từ khóa và trả câu dựng sẵn.
- MoMo (sandbox): mặc định dùng bộ khóa test công khai của MoMo, không cần cấu hình; tài khoản thật đặt `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_ENDPOINT`.
- Trong MongoDB Atlas, cho phép địa chỉ IP hiện tại trong **Network Access** và tạo Database User có quyền phù hợp.

## Chạy API và giao diện

Mỗi tiến trình chạy trong một Terminal riêng. Giữ cả hai Terminal mở khi sử dụng ứng dụng.

### Terminal 1 - API backend

Từ thư mục gốc dự án:

```powershell
npm start
```

Chế độ tự khởi động lại khi sửa backend:

```powershell
npm run dev
```

API chạy tại `http://localhost:5000`. Kiểm tra kết nối server bằng:

```text
http://localhost:5000/api/health
```

Route `/` chưa có trang chủ; nếu mở `http://localhost:5000/` và thấy `Cannot GET /` thì đó không phải lỗi API.

### Terminal 2 - Frontend

Từ thư mục gốc:

```powershell
cd .\Hotel-RAG-FE
npm run dev
```

Mở URL Vite in trong Terminal, thông thường là `http://localhost:5173`. Frontend gọi API theo biến `VITE_API_URL` (file `Hotel-RAG-FE/.env`, mẫu ở `Hotel-RAG-FE/.env.example`); không đặt thì mặc định là `http://localhost:5000/api` (`Hotel-RAG-FE/src/services/api.js`).

## Cơ chế RAG tìm khách sạn và xe đưa đón

Trợ lý là **RAG Chatbot** (không phải AI Agent — không có tool registry/planning/multi-step). Chi tiết: [`docs/rag-pipeline.md`](docs/rag-pipeline.md).

1. **Tạo embedding:** khi Admin duyệt khách sạn, backend ghép tên, mô tả, tiện ích, địa chỉ và dùng model `bge-m3` (chạy bằng Ollama) tạo vector 1024 chiều, lưu ở trường `embedding`. Câu hỏi của khách cũng được tạo vector bằng đúng model này.
2. **Tách ràng buộc cứng** từ câu hỏi (`services/queryConstraintParser.js`): thành phố, **tỉnh** (63 tỉnh, địa danh như Vũng Tàu / Sa Pa, tên sân bay như Nội Bài), ngày ở, số khách, số phòng, ngân sách, tiện nghi bắt buộc, loại phòng, và **ý định đặt xe đưa đón** (kèm chiều: đón từ sân bay / ra sân bay). Câu ngoài phạm vi/độc hại bị guardrail từ chối.
3. **Lọc có cấu trúc + kiểm tra quỹ phòng** (`services/ragRetrieval.js`): chỉ giữ hạng phòng đang bán của KS đã duyệt, đúng ràng buộc (thành phố, hoặc tỉnh khi khách chỉ nêu tỉnh), còn đủ phòng **mọi đêm** và giá theo ngày nằm trong ngân sách.
4. **Xếp hạng ngữ nghĩa** trên tập hợp lệ: 0.7 × cosine(vector câu hỏi, vector KS) + 0.3 × điểm từ khóa.
5. **Xe đưa đón** (khi câu hỏi có ý định đặt xe): tìm tuyến còn đặt được theo tỉnh, ngày và số khách (`transferService.findTransferOptions`, dùng chung với trang Xe đưa đón); tuyến đúng chiều khách hỏi xếp trước, trích dẫn `[X1]`, `[X2]`... Câu chỉ hỏi xe thì không tìm phòng; "khách sạn có đưa đón sân bay" vẫn là tiện nghi khách sạn; chưa nêu tỉnh thì chatbot hỏi lại.
6. **Sinh câu trả lời:** model `dolphin3` (Ollama) chỉ dùng các lựa chọn đã đánh số và phải trích dẫn `[n]` / `[Xn]`; nếu Ollama lỗi / chưa chạy thì trả câu trả lời dựng từ dữ liệu.
7. **Ghi log** vào `raglogs` (ràng buộc, thứ tự truy xuất, tuyến xe đã gợi ý, số ứng viên từng bước, độ trễ) để đánh giá ở trang Admin → RAG Analytics (`/admin/rag`).

Ví dụ câu hỏi: *"Phòng ở Đà Nẵng cho 2 người, dưới 1,5 triệu/đêm, có hồ bơi"*, *"Khách sạn ở Lâm Đồng"*, *"Xe đón tôi từ sân bay Đà Lạt ngày 5/12 cho 3 người"*, *"Đặt phòng ở Hội An và xe ra sân bay"*. Widget chat hiện thẻ phòng (mở trang khách sạn) và thẻ xe (mở trang Xe đưa đón đã điền sẵn tỉnh / ngày / số khách).

### Cấu hình Atlas Vector Search (chỉ cho benchmark)

Chatbot tự tính cosine trên tập khách sạn đã lọc nên **không cần** index này để chạy. Index chỉ dùng cho baseline "vector thuần" của `npm run rag:benchmark`. Nếu cần, tạo Search Index cho collection `hotels`:

- Tên index: `default` (phải khớp với tên trong code).
- Đường dẫn vector: `embedding`.
- Kiểu: `knnVector`.
- Số chiều: `1024` (model `bge-m3`).
- Similarity: `cosine`.

Ví dụ định nghĩa index:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "embedding": {
        "type": "knnVector",
        "dimensions": 1024,
        "similarity": "cosine"
      }
    }
  }
}
```

Chỉ các khách sạn đã có embedding mới phù hợp với tìm kiếm vector. Nếu collection chưa có embedding (hoặc vector của model cũ), chạy `node Hotel-RAG-BE/scripts/seedMockData.js --embeddings`; việc tạo index không tự sinh embedding.

## Chức năng theo vai trò

### Khách hàng (Customer)

- Đăng ký bằng tên đăng nhập + email + mật khẩu, xác nhận email qua link; đăng nhập bằng tên đăng nhập; quên mật khẩu → link đặt lại gửi qua email (Brevo). Một email dùng được cho nhiều tài khoản.
- Xem / lọc khách sạn đã duyệt (theo tỉnh, giá, tiện nghi), trang chi tiết với hạng phòng và giá theo ngày.
- Dùng widget AI để tìm khách sạn và xe đưa đón bằng câu hỏi tự nhiên (RAG).
- Lưu khách sạn **yêu thích** (nút trái tim), xem lại ở tab "Yêu thích" trong trang Tài khoản.
- Đặt phòng: chọn hạng phòng, ngày, số lượng → đơn `Pending` giữ phòng 5 phút; áp **mã giảm giá** ở trang thanh toán; thanh toán qua **VNPay** hoặc **MoMo** (sandbox). Thanh toán thành công → đơn `Confirmed`, ghi `payments`.
- Xem lịch sử đặt phòng / đặt xe, hủy đơn chưa thanh toán, viết đánh giá sau khi trả phòng.
- Nhận **thông báo trong trang** (chuông trên header) khi đơn thanh toán thành công, đơn bị hủy, hồ sơ được duyệt.

### Đối tác (Partner)

- Người dùng đã đăng nhập có thể bấm **Làm shop** để gửi yêu cầu; trạng thái `Pending` được lưu trong tài khoản ở MongoDB.
- Quản trị viên duyệt hoặc từ chối yêu cầu. Khi được duyệt, role của tài khoản chuyển thành `Partner`.
- **Trung tâm đối tác** (`/partner`, role `Partner` hoặc `Admin`): tạo / sửa khách sạn (gửi Admin duyệt), hạng phòng, giá và số phòng trống theo khoảng ngày; xem đơn, xác nhận trả phòng.
- Tạo **mã giảm giá** cho khách sạn của mình; xem **biểu đồ doanh thu** và **tỷ lệ lấp phòng** theo tháng.
- Nhận thông báo khi có đơn mới đã thanh toán, khách hủy đơn, khách sạn được duyệt / từ chối.

### Nhà xe (Transport) — xe đưa đón

- Khách hàng đã đăng nhập vào **Đăng ký làm nhà xe** (`/transport-apply`): tên nhà xe, SĐT, số giấy phép kinh doanh vận tải, tỉnh/thành phục vụ. Admin duyệt ở tab **Duyệt nhà xe** → role chuyển thành `Transport` (gỡ duyệt → trả về `Customer`).
- **Trung tâm nhà xe** (`/transport`): thêm/sửa/ẩn loại xe (số chỗ, vali, tổng số xe, tiện nghi, ảnh), thêm tuyến (điểm đón → điểm trả, giá trọn gói / xe), chỉnh số xe trống theo khoảng ngày, xem đơn và bấm "Đã đón khách".
- Khách tìm xe ở **Xe đưa đón** (`/transfers`) theo tỉnh / khách sạn, ngày, số khách (tự tính số xe cần), giữ xe 5 phút và thanh toán VNPay / MoMo như đơn phòng (áp được mã giảm giá). Có thể hỏi chatbot, ví dụ "xe đón sân bay Đà Nẵng ngày 20/12 cho 4 người". Trang chi tiết khách sạn, trang thanh toán thành công và lịch sử đặt phòng có lối tắt "Đặt xe đưa đón".
- Cùng cơ chế với đặt phòng: trừ xe nguyên tử theo ngày, `Idempotency-Key`, cronjob hủy đơn quá hạn và trả xe.

### Quản trị viên (Admin)

- Trang `/admin` (role `Admin`), mỗi tab có địa chỉ riêng (`?tab=`):
  - Người dùng: tìm theo tên đăng nhập / tên / email / SĐT, lọc vai trò / trạng thái, khóa / mở khóa (không tự khóa chính mình).
  - Duyệt đối tác, duyệt khách sạn (duyệt sẽ tạo vector `bge-m3` cho chatbot), duyệt nhà xe.
  - **Mã giảm giá** toàn sàn (cho phòng, xe hoặc cả hai).
  - **Thống kê & báo cáo**: doanh thu phòng + xe, số đơn, tỷ lệ lấp phòng theo tháng; **xuất Excel / CSV** đơn đặt và doanh thu theo khoảng ngày.
- Trang `/admin/rag`: chỉ số RAG (HitRate, Recall, nDCG, Groundedness...).
- Nhận thông báo khi có hồ sơ đối tác / khách sạn / nhà xe mới chờ duyệt.

## API chính

Ma trận phân quyền đầy đủ của mọi endpoint: [`docs/security-rbac.md`](docs/security-rbac.md).

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Công khai | Kiểm tra API |
| `GET` | `/api/hotels`, `/api/hotels/search`, `/api/hotels/featured` | Công khai | Danh sách / tìm kiếm (`?amenities=Hồ bơi,Spa` lọc theo tiện nghi, trả `priceFrom`) / top 8 khách sạn |
| `GET` | `/api/hotels/provinces` | Công khai | 63 tỉnh/thành (A→Z) kèm số khách sạn; bộ lọc gửi `?province=` cho `/api/hotels/search` |
| `GET` | `/api/hotels/amenities` | Công khai | Danh mục tiện nghi chuẩn kèm số khách sạn (dùng cho bộ lọc) |
| `GET` | `/api/hotels/:id`, `/api/hotels/:id/rooms` | Công khai | Chi tiết KS, hạng phòng + giá động theo ngày |
| `POST` | `/api/auth/register` | Công khai | Đăng ký bằng tên đăng nhập + email + mật khẩu; gửi email xác nhận. Tên đăng nhập không trùng, một email dùng được cho nhiều tài khoản |
| `POST` | `/api/auth/login` | Công khai | Đăng nhập bằng tên đăng nhập + mật khẩu (JWT); chưa xác nhận email → 403 `EMAIL_NOT_VERIFIED` |
| `POST` | `/api/auth/verify-email`, `/api/auth/resend-verification` | Công khai | Xác nhận email bằng token trong link / gửi lại email xác nhận |
| `POST` | `/api/auth/forgot-password`, `/api/auth/reset-password` | Công khai | Gửi link đặt lại mật khẩu qua email (hạn 30 phút) / đặt mật khẩu mới bằng token |
| `GET/PUT` | `/api/users/me`, `PUT /api/users/me/password` | Đăng nhập | Hồ sơ cá nhân, đổi mật khẩu |
| `GET/POST/DELETE` | `/api/users/me/wishlist`, `/api/users/me/wishlist/:hotelId` | Đăng nhập | Danh sách khách sạn yêu thích: xem / thêm / bỏ |
| `GET/PUT` | `/api/notifications`, `/api/notifications/:id/read`, `/api/notifications/read-all` | Đăng nhập | Thông báo trong trang (đơn mới, đơn hủy, kết quả duyệt hồ sơ) |
| `POST` | `/api/ai/search` | Công khai | Trợ lý RAG: trả `answer`, `rooms` (trích dẫn `[n]`), `transfers` (xe đưa đón, trích dẫn `[Xn]`), `constraints` |
| `POST` | `/api/bookings` | Đăng nhập | Tạo đơn, giữ chỗ 5 phút; header `Idempotency-Key` chống đặt trùng |
| `GET` | `/api/bookings/my-bookings`, `/api/bookings/:id` | Chủ đơn | Lịch sử / chi tiết đơn |
| `PUT` | `/api/bookings/:id/cancel` | Chủ đơn | Hủy đơn chưa thanh toán, hoàn quỹ phòng |
| `POST` | `/api/payments/vnpay/create_url` | Chủ đơn | Tạo link thanh toán VNPay |
| `GET` | `/api/payments/vnpay/return` | Chữ ký VNPay | Xác nhận kết quả thanh toán (kiểm tra số tiền khớp đơn), ghi `payments` (Success/Failed) |
| `POST` | `/api/payments/momo/create_url` | Chủ đơn | Tạo link thanh toán MoMo (sandbox) cho đơn phòng / đơn xe |
| `GET/POST` | `/api/payments/momo/return`, `/api/payments/momo/ipn` | Chữ ký MoMo (HMAC-SHA256) | Kết quả MoMo khi trình duyệt quay về / do server MoMo gọi |
| `PUT/DELETE` | `/api/bookings/:id/coupon`, `/api/transfers/:id/coupon` | Chủ đơn (đơn đang chờ thanh toán) | Áp / bỏ mã giảm giá, tính lại tổng tiền |
| `GET` | `/api/coupons/available?kind=hotel\|transfer&hotelId=` | Đăng nhập | Mã đang dùng được (gợi ý ở trang thanh toán) |
| `GET/POST/PUT/DELETE` | `/api/coupons`, `/api/coupons/:id` | Admin (mã toàn sàn), Partner (mã KS của mình) | Quản lý mã giảm giá |
| `GET` | `/api/reviews/hotel/:hotelId` | Công khai | Đánh giá của khách sạn |
| `POST` | `/api/reviews` | Chủ đơn `Completed` | Viết đánh giá 1–5 sao |
| `POST/GET` | `/api/partner/hotels` | Partner, Admin | Tạo / xem khách sạn của mình |
| `PUT` | `/api/partner/hotels/:hotelId` | Chủ KS, Admin | Sửa tên, mô tả, địa chỉ, tiện nghi, ảnh (KS bị từ chối sẽ được gửi duyệt lại) |
| `PUT` | `/api/partner/rooms/:roomId` | Chủ KS, Admin | Sửa hạng phòng: tiện nghi, ảnh, mô tả, giá gốc, sức chứa, tổng số phòng |
| `POST` | `/api/partner/hotels/:hotelId/rooms` | Chủ KS, Admin | Tạo hạng phòng |
| `PUT` | `/api/partner/rooms/:roomId/toggle` | Chủ KS, Admin | Khóa / mở bán hạng phòng |
| `PUT` | `/api/partner/inventory` | Chủ KS, Admin | Cập nhật giá / số phòng trống theo khoảng ngày |
| `GET` | `/api/partner/bookings` | Chủ KS, Admin | Đơn của KS + thống kê nhận/trả phòng |
| `PUT` | `/api/partner/bookings/:id/complete` | Chủ KS, Admin | Xác nhận khách trả phòng |
| `POST/GET` | `/api/partner/apply`, `/api/partner/application-status` | Đăng nhập | Đăng ký làm đối tác |
| `GET/PUT` | `/api/partner/applications/...` | Admin | Duyệt / từ chối đối tác |
| `GET/PUT` | `/api/admin/users`, `/api/admin/users/:userId/status` | Admin | Quản lý / khóa người dùng |
| `GET` | `/api/admin/hotels?status=` | Admin | Toàn bộ KS theo trạng thái |
| `PUT` | `/api/admin/hotels/:id/status` | Admin | Duyệt (`Approved`, tạo embedding) / từ chối (`Rejected`) |
| `GET/POST` | `/api/admin/rag-analytics`, `/api/admin/rag/evaluate` | Admin | Chỉ số RAG, chấm Groundedness |
| `GET` | `/api/partner/stats?months=` | Partner, Admin | Doanh thu, số đơn, tỷ lệ lấp phòng theo tháng (khách sạn của mình) |
| `GET` | `/api/admin/stats?months=` | Admin | Thống kê toàn sàn: doanh thu phòng + xe, tỷ lệ lấp phòng |
| `GET` | `/api/admin/reports/export?format=xlsx\|csv&type=hotel\|transfer\|monthly&from=&to=` | Admin | Xuất báo cáo đơn đặt và doanh thu ra Excel / CSV |
| `GET` | `/api/transfers/provinces`, `/api/transfers/search?province=\|hotelId=&date=&passengers=` | Công khai | 63 tỉnh kèm số tuyến xe / tìm xe đưa đón còn trống |
| `POST` | `/api/transfers` | Đăng nhập | Đặt xe, giữ xe 5 phút; header `Idempotency-Key` |
| `GET/PUT` | `/api/transfers/my`, `/api/transfers/:id`, `PUT /api/transfers/:id/cancel` | Chủ đơn | Lịch sử / chi tiết / hủy đơn xe |
| `POST` | `/api/payments/vnpay/create_url` body `{ transferBookingId }` | Chủ đơn | Thanh toán đơn xe (dùng chung VNPay) |
| `GET/POST/PUT` | `/api/transport/my-company`, `/api/transport/apply` | Đăng nhập | Hồ sơ nhà xe / đăng ký làm nhà xe |
| `GET/POST/PUT` | `/api/transport/vehicles[/:vehicleId]`, `/vehicles/:vehicleId/routes`, `/routes/:routeId`, `/vehicles/:vehicleId/inventory` | Nhà xe (của mình), Admin | Loại xe, tuyến, số xe trống theo ngày |
| `GET/PUT` | `/api/transport/bookings`, `/api/transport/bookings/:id/complete` | Nhà xe | Đơn đặt xe + thống kê, xác nhận đã đón |
| `GET/PUT` | `/api/admin/transport-companies`, `/api/admin/transport-companies/:id/status` | Admin | Duyệt / từ chối / gỡ duyệt nhà xe |

## Kiểm thử và đánh giá

### Test API (backend)

Test **xóa sạch database** được chỉ định, nên chỉ chạy trên MongoDB riêng có tên kết thúc bằng `_test` (script tự từ chối nếu không đúng). Ví dụ với MongoDB cài trên máy:

```powershell
$env:TEST_MONGO_URI = "mongodb://127.0.0.1:27017/hotelrag_test"
npm test
```

Bộ test (`Hotel-RAG-BE/tests/`, 125 test) gồm:

| File | Nội dung |
| --- | --- |
| `rbac.test.js` | Phân quyền 401/403 và quyền sở hữu |
| `auth.test.js` | Đăng ký, xác nhận email, đăng nhập, quên / đặt lại mật khẩu |
| `booking-concurrency.test.js` | Đặt phòng đồng thời, rollback, idempotency |
| `rag-pipeline.test.js` | Pipeline RAG với ràng buộc cứng, guardrail, RagLog |
| `chatbot-transfer.test.js` | Chatbot: câu hỏi xe đưa đón, câu hỏi theo tỉnh |
| `embedding.test.js`, `llm-ollama.test.js` | Tạo vector khi duyệt / sửa khách sạn, gọi Ollama (`/api/chat`, `/api/embed`) |
| `transfer.test.js` | Nhà xe, tìm / đặt xe đồng thời, hủy, thanh toán đơn xe |
| `coupon.test.js`, `wishlist.test.js` | Mã giảm giá (giữ / trả lượt), danh sách yêu thích |
| `momo-notification.test.js`, `vnpay-time.test.js` | Thanh toán MoMo + thông báo, giờ VNPay (GMT+7) |
| `report.test.js` | Thống kê doanh thu / lấp phòng, xuất Excel / CSV |
| `provinces.test.js`, `partner-edit-amenities.test.js` | Danh mục 63 tỉnh, sửa khách sạn / tiện nghi |

### Đánh giá RAG

```powershell
npm run rag:benchmark   # keyword vs vector vs pipeline trên golden_dataset.json -> docs/rag-benchmark.md
npm run rag:replay      # (cần API đang chạy) gửi Golden Query Set qua /api/ai/search, gắn nhãn vào raglogs
```

### Dữ liệu mock

```powershell
npm run seed:mock                  # chuẩn hóa dữ liệu + thêm user/booking/payment/review mock (chạy lại không trùng)
node Hotel-RAG-BE/scripts/seedMockData.js --embeddings   # thêm: tạo lại vector AI bị thiếu / của model cũ (gọi Ollama bge-m3)
```

### Tài liệu cho báo cáo

| Tài liệu | Nội dung |
| --- | --- |
| [`docs/progress-and-scope.md`](docs/progress-and-scope.md) | Phạm vi, Task–Owner–Deadline–%–Evidence |
| [`docs/rag-pipeline.md`](docs/rag-pipeline.md) | Thuật ngữ (RAG, không phải Agent), pipeline ràng buộc cứng, câu hỏi xe đưa đón / theo tỉnh |
| [`docs/rag-benchmark.md`](docs/rag-benchmark.md) | Benchmark + error analysis |
| [`docs/booking-concurrency.md`](docs/booking-concurrency.md) | Chống oversell, rollback, idempotency |
| [`docs/security-rbac.md`](docs/security-rbac.md) | Ma trận phân quyền, lỗ hổng đã vá |
| [`docs/implementation-status.md`](docs/implementation-status.md) | Implemented / Prototype / Mock / Planned |
| [`docs/erd.mmd`](docs/erd.mmd), [`docs/data-dictionary.md`](docs/data-dictionary.md) | Sơ đồ ERD (Mermaid) và giải thích từng trường dữ liệu |
| [`docs/local-llm-dolphin.md`](docs/local-llm-dolphin.md) | Chạy Dolphin 3.0 Llama 3.1 8B local qua Ollama |
| [`docs/aws-ollama.md`](docs/aws-ollama.md) | Chạy Ollama trên AWS EC2 GPU, kết nối an toàn bằng SSH tunnel / reverse proxy |
| [`docs/colab-ollama.md`](docs/colab-ollama.md) | Chạy Dolphin 3.0 + `bge-m3` trên Google Colab (GPU T4 miễn phí) qua tunnel có khóa — notebook `colab/ollama_dolphin_colab.ipynb` |
| [`docs/deploy-render.md`](docs/deploy-render.md) | Deploy backend + frontend lên Render, gọi Ollama trên Colab |

## Kiểm tra frontend

Từ `Hotel-RAG-FE`:

```powershell
npm run lint
npm run build
```

## Lưu ý triển khai

- **Deploy lên Render:** xem [docs/deploy-render.md](docs/deploy-render.md). File `render.yaml` khai báo sẵn backend (Web Service) và frontend (Static Site); mẫu biến môi trường ở `.env.example` và `Hotel-RAG-FE/.env.example`.
- URL `localhost` chỉ dùng khi frontend và backend chạy trên cùng máy phát triển. Khi deploy, đặt biến `VITE_API_URL` (frontend) thành địa chỉ API thật; có thể giới hạn domain gọi API bằng `CORS_ORIGIN` (backend).
- Không commit `.env`, mật khẩu database, JWT secret, API key Brevo, khóa Ollama.
- VNPay và MoMo đang chạy sandbox: VNPay cần `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL`, `VNP_RETURN_URL`; MoMo mặc định dùng khóa test công khai. Cả hai chỉ xác nhận đơn khi số tiền trả khớp tổng tiền của đơn.
- Booking chỉ tạo được khi tồn kho có đủ bản ghi cho toàn bộ ngày lưu trú. Tạo booking trừ tồn kho ngay (giữ chỗ 5 phút); cronjob mỗi phút hủy đơn Pending quá hạn và hoàn tồn kho.
- Mọi API cần quyền đều kiểm tra JWT, vai trò và quyền sở hữu ở backend (`authMiddleware.js`, `ownershipMiddleware.js`).
