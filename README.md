# Nestly - Hotel Booking AI

Đồ án website đặt phòng khách sạn có trợ lý tìm kiếm bằng RAG. Frontend dùng React/Vite, API dùng Express/Mongoose và dữ liệu lưu trên MongoDB.

## Công nghệ và công cụ

- Node.js 20.19+ hoặc 22.12+ (khuyến nghị Node.js 22 LTS trở lên).
- npm.
- MongoDB Atlas với quyền đọc/ghi database.
- Gemini API key để tạo embedding và câu trả lời AI.
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
GEMINI_API_KEY=<gemini-api-key>
JWT_SECRET=<chuoi-bi-mat-dai-va-ngau-nhien>
```

- `MONGO_URI`: connection string MongoDB Atlas, có tên database, ví dụ `Hotel-RAG`.
- `GEMINI_API_KEY`: API key được phép dùng Gemini.
- `JWT_SECRET`: chuỗi bí mật do bạn tự tạo, dùng để ký/xác minh token đăng nhập.
- Không bắt buộc — sinh câu trả lời AI bằng model chạy local thay cho Gemini: `LLM_PROVIDER=ollama`, `OLLAMA_MODEL=dolphin3` (xem [`docs/local-llm-dolphin.md`](docs/local-llm-dolphin.md)). Mặc định `LLM_PROVIDER=gemini`.
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

Mở URL Vite in trong Terminal, thông thường là `http://localhost:5173`. Frontend hiện gọi API tại `http://localhost:5000/api`, cấu hình trong `Hotel-RAG-FE/src/services/api.js`.

## Cơ chế RAG tìm khách sạn

Trợ lý là **RAG Chatbot** (không phải AI Agent — không có tool registry/planning/multi-step). Chi tiết: [`docs/rag-pipeline.md`](docs/rag-pipeline.md).

1. **Tạo embedding:** khi Admin duyệt khách sạn, backend ghép tên, mô tả, tiện ích, địa chỉ và dùng Gemini `gemini-embedding-001` tạo vector 3072 chiều, lưu ở trường `embedding`.
2. **Tách ràng buộc cứng** từ câu hỏi (`services/queryConstraintParser.js`): thành phố, ngày ở, số khách, số phòng, ngân sách, tiện nghi bắt buộc, loại phòng. Câu ngoài phạm vi/độc hại bị guardrail từ chối.
3. **Lọc có cấu trúc + kiểm tra quỹ phòng** (`services/ragRetrieval.js`): chỉ giữ hạng phòng đang bán của KS đã duyệt, đúng ràng buộc, còn đủ phòng **mọi đêm** và giá theo ngày nằm trong ngân sách.
4. **Xếp hạng ngữ nghĩa** trên tập hợp lệ: 0.7 × cosine(vector câu hỏi, vector KS) + 0.3 × điểm từ khóa.
5. **Sinh câu trả lời:** Gemini chỉ dùng các lựa chọn đã đánh số và phải trích dẫn `[n]`; nếu Gemini lỗi/hết hạn mức thì trả câu trả lời dựng từ dữ liệu.
6. **Ghi log** vào `raglogs` (ràng buộc, thứ tự truy xuất, số ứng viên từng bước, độ trễ) để đánh giá ở trang Admin → RAG Analytics (`/admin/rag`).

### Cấu hình Atlas Vector Search

Trong MongoDB Atlas, tạo Search Index cho collection `hotels`:

- Tên index: `default` (phải khớp với tên trong code).
- Đường dẫn vector: `embedding`.
- Kiểu: `knnVector`.
- Số chiều: `3072`.
- Similarity: `cosine`.

Ví dụ định nghĩa index:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "embedding": {
        "type": "knnVector",
        "dimensions": 3072,
        "similarity": "cosine"
      }
    }
  }
}
```

Chỉ các khách sạn đã có embedding mới phù hợp với tìm kiếm vector. Nếu collection chưa có embedding, cần tạo lại embedding cho dữ liệu đó; việc tạo index không tự sinh embedding.

## Chức năng theo vai trò

### Khách hàng (Customer)

- Đăng ký và đăng nhập; backend lưu tài khoản trong MongoDB và phát JWT.
- Xem danh sách khách sạn đã duyệt và trang chi tiết/loại phòng từ API.
- Dùng widget AI để tìm khách sạn bằng mô tả tự nhiên (RAG).
- Chọn loại phòng, ngày nhận/trả phòng, số lượng và gửi yêu cầu đặt phòng.
- Thanh toán demo từ bước đặt phòng hoặc lịch sử booking: mô phỏng thành công, lưu bản ghi thanh toán trong MongoDB và chuyển booking sang `Confirmed`. Không nhập thẻ và không thu tiền thật.
- Xem lịch sử đặt chỗ của chính tài khoản ở trang hồ sơ. Backend xác minh JWT và chỉ truy vấn booking thuộc tài khoản đó.
- Đơn đặt phòng được lưu trong MongoDB ở collection `bookings`, trạng thái ban đầu là `Pending`; tồn kho được kiểm tra khi gửi đơn. Thanh toán demo lưu ở collection `payments`.

### Đối tác (Partner)

- Người dùng đã đăng nhập có thể bấm **Làm shop** để gửi yêu cầu; trạng thái `Pending` được lưu trong tài khoản ở MongoDB.
- Quản trị viên duyệt hoặc từ chối yêu cầu. Khi được duyệt, role của tài khoản chuyển thành `Partner`.
- Route `/partner` dành cho role `Partner` hoặc `Admin`; backend bảo vệ API tạo khách sạn, loại phòng và cập nhật tồn kho bằng JWT/role.
- **Lưu ý:** dashboard đối tác vẫn hiển thị một phần số liệu và nội dung mẫu, chưa nối hoàn chỉnh để quản lý dữ liệu thực.

### Quản trị viên (Admin)

- Có route `/admin` dành cho role `Admin`.
- Có thể xem danh sách người dùng, tìm theo tên/email/số điện thoại, lọc theo vai trò/trạng thái và khóa/mở khóa tài khoản. Admin không thể tự thay đổi trạng thái tài khoản đang đăng nhập.
- Backend có API lấy yêu cầu làm shop, duyệt/từ chối yêu cầu, lấy danh sách người dùng, khóa/mở khóa tài khoản, lấy khách sạn chờ duyệt và duyệt khách sạn; các API quản trị yêu cầu JWT với role `Admin`.
- Duyệt khách sạn gọi dịch vụ tạo embedding.
- **Lưu ý:** tab duyệt khách sạn trên dashboard vẫn đang hiển thị dữ liệu mẫu; thao tác duyệt/từ chối tại tab này chưa nối hoàn chỉnh với API khách sạn.

## API chính

Ma trận phân quyền đầy đủ của mọi endpoint: [`docs/security-rbac.md`](docs/security-rbac.md).

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Công khai | Kiểm tra API |
| `GET` | `/api/hotels`, `/api/hotels/search`, `/api/hotels/featured` | Công khai | Danh sách / tìm kiếm (`?amenities=Hồ bơi,Spa` lọc theo tiện nghi, trả `priceFrom`) / top 8 khách sạn |
| `GET` | `/api/hotels/amenities` | Công khai | Danh mục tiện nghi chuẩn kèm số khách sạn (dùng cho bộ lọc) |
| `GET` | `/api/hotels/:id`, `/api/hotels/:id/rooms` | Công khai | Chi tiết KS, hạng phòng + giá động theo ngày |
| `POST` | `/api/auth/register`, `/api/auth/login` | Công khai | Đăng ký, đăng nhập (JWT) |
| `GET/PUT` | `/api/users/me`, `PUT /api/users/me/password` | Đăng nhập | Hồ sơ cá nhân, đổi mật khẩu |
| `POST` | `/api/ai/search` | Công khai | Trợ lý RAG |
| `POST` | `/api/bookings` | Đăng nhập | Tạo đơn, giữ chỗ 5 phút; header `Idempotency-Key` chống đặt trùng |
| `GET` | `/api/bookings/my-bookings`, `/api/bookings/:id` | Chủ đơn | Lịch sử / chi tiết đơn |
| `PUT` | `/api/bookings/:id/cancel` | Chủ đơn | Hủy đơn chưa thanh toán, hoàn quỹ phòng |
| `POST` | `/api/payments/vnpay/create_url` | Chủ đơn | Tạo link thanh toán VNPay |
| `GET` | `/api/payments/vnpay/return` | Chữ ký VNPay | Xác nhận kết quả thanh toán, ghi `payments` (Success/Failed) |
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

## Kiểm thử và đánh giá

### Test API (backend)

Test **xóa sạch database** được chỉ định, nên chỉ chạy trên MongoDB riêng có tên kết thúc bằng `_test` (script tự từ chối nếu không đúng). Ví dụ với MongoDB cài trên máy:

```powershell
$env:TEST_MONGO_URI = "mongodb://127.0.0.1:27017/hotelrag_test"
npm test
```

Bộ test gồm: phân quyền 401/403 và ownership (`tests/rbac.test.js`), đặt phòng đồng thời / rollback / idempotency (`tests/booking-concurrency.test.js`), pipeline RAG với ràng buộc cứng (`tests/rag-pipeline.test.js`).

### Đánh giá RAG

```powershell
npm run rag:benchmark   # keyword vs vector vs pipeline trên golden_dataset.json -> docs/rag-benchmark.md
npm run rag:replay      # (cần API đang chạy) gửi Golden Query Set qua /api/ai/search, gắn nhãn vào raglogs
```

### Dữ liệu mock

```powershell
npm run seed:mock                  # chuẩn hóa dữ liệu + thêm user/booking/payment/review mock (chạy lại không trùng)
node Hotel-RAG-BE/scripts/seedMockData.js --embeddings   # thêm: tạo lại vector AI bị thiếu (gọi Gemini)
```

### Tài liệu cho báo cáo

| Tài liệu | Nội dung |
| --- | --- |
| [`docs/progress-and-scope.md`](docs/progress-and-scope.md) | Phạm vi, Task–Owner–Deadline–%–Evidence |
| [`docs/rag-pipeline.md`](docs/rag-pipeline.md) | Thuật ngữ (RAG, không phải Agent), pipeline ràng buộc cứng |
| [`docs/rag-benchmark.md`](docs/rag-benchmark.md) | Benchmark + error analysis |
| [`docs/booking-concurrency.md`](docs/booking-concurrency.md) | Chống oversell, rollback, idempotency |
| [`docs/security-rbac.md`](docs/security-rbac.md) | Ma trận phân quyền, lỗ hổng đã vá |
| [`docs/implementation-status.md`](docs/implementation-status.md) | Implemented / Prototype / Mock / Planned |
| [`docs/local-llm-dolphin.md`](docs/local-llm-dolphin.md) | Chạy Dolphin 3.0 Llama 3.1 8B local qua Ollama |
| [`docs/aws-ollama.md`](docs/aws-ollama.md) | Chạy Ollama trên AWS EC2 GPU, kết nối an toàn bằng SSH tunnel / reverse proxy |
| [`docs/colab-ollama.md`](docs/colab-ollama.md) | Chạy Dolphin 3.0 trên Google Colab (GPU T4 miễn phí) qua tunnel có khóa — notebook `colab/ollama_dolphin_colab.ipynb` |

## Kiểm tra frontend

Từ `Hotel-RAG-FE`:

```powershell
npm run lint
npm run build
```

## Lưu ý triển khai

- URL `localhost` chỉ dùng khi frontend và backend chạy trên cùng máy phát triển. Khi deploy, cập nhật `baseURL` frontend thành địa chỉ API thật.
- Không commit `.env`, mật khẩu database, JWT secret hoặc Gemini API key.
- VNPay đang ở mức Prototype: cần cấu hình `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL`, `VNP_RETURN_URL` và kiểm thử trên sandbox trước khi trình diễn.
- Booking chỉ tạo được khi tồn kho có đủ bản ghi cho toàn bộ ngày lưu trú. Tạo booking trừ tồn kho ngay (giữ chỗ 5 phút); cronjob mỗi phút hủy đơn Pending quá hạn và hoàn tồn kho.
- Mọi API cần quyền đều kiểm tra JWT, vai trò và quyền sở hữu ở backend (`authMiddleware.js`, `ownershipMiddleware.js`).
