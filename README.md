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

RAG kết hợp tìm tài liệu liên quan trong database với mô hình sinh câu trả lời:

1. **Nạp dữ liệu / tạo embedding:** khi quản trị viên duyệt khách sạn qua API, backend ghép tên, mô tả, tiện ích và địa chỉ rồi dùng Gemini `gemini-embedding-001` chuyển nội dung thành vector. Vector lưu ở trường `embedding` của tài liệu khách sạn trong MongoDB.
2. **Nhận câu hỏi:** widget trợ lý gửi câu hỏi tới `POST /api/ai/search`.
3. **Truy xuất khách sạn:** backend chuyển câu hỏi thành vector, dùng Atlas Search tìm tối đa 3 khách sạn gần nghĩa trong trường `embedding`, sau đó chỉ giữ khách sạn có trạng thái `Approved`.
4. **Sinh câu trả lời:** backend đưa câu hỏi cùng dữ liệu khách sạn tìm được cho Gemini tạo đoạn tư vấn bằng tiếng Việt. API trả về nội dung tư vấn và danh sách khách sạn gợi ý.

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
- Backend có API lấy yêu cầu làm shop, duyệt/từ chối yêu cầu, lấy khách sạn chờ duyệt và duyệt khách sạn; các API admin yêu cầu JWT với role `Admin`.
- Duyệt khách sạn gọi dịch vụ tạo embedding.
- **Lưu ý trạng thái hiện tại:** dashboard quản trị hiển thị dữ liệu mẫu và thao tác trên giao diện chưa nối hoàn chỉnh với các API quản trị.

> Kiểm tra role trong frontend chỉ phục vụ điều hướng giao diện. Các API partner/admin hiện chưa được bảo vệ đầy đủ bằng middleware xác thực và phân quyền backend; không nên xem đây là cấu hình an toàn để triển khai production.

## API chính

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/api/health` | Kiểm tra API đang chạy |
| `GET` | `/api/hotels` | Lấy danh sách khách sạn đã duyệt |
| `GET` | `/api/hotels/:id` | Lấy chi tiết khách sạn |
| `GET` | `/api/hotels/:id/rooms` | Lấy loại phòng của khách sạn |
| `POST` | `/api/auth/register` | Đăng ký |
| `POST` | `/api/auth/login` | Đăng nhập, nhận JWT |
| `POST` | `/api/ai/search` | Tìm kiếm và tư vấn khách sạn bằng RAG |
| `POST` | `/api/bookings` | Tạo booking (cần JWT) |
| `GET` | `/api/bookings/mine` | Lịch sử booking của tài khoản hiện tại (cần JWT) |
| `POST` | `/api/payments/demo/:bookingId` | Mô phỏng thanh toán và xác nhận booking của tài khoản hiện tại (cần JWT) |
| `GET` | `/api/admin/hotels/pending` | Lấy khách sạn chờ duyệt |
| `PUT` | `/api/admin/hotels/:id/approve` | Duyệt khách sạn và tạo embedding |
| `POST` | `/api/partner/hotels` | Tạo khách sạn đối tác |
| `POST` | `/api/partner/hotels/:hotelId/rooms` | Tạo loại phòng |
| `PUT` | `/api/partner/inventory/:inventoryId` | Cập nhật tồn kho |
| `GET` | `/api/partner/application-status` | Trạng thái yêu cầu làm shop (cần JWT) |
| `POST` | `/api/partner/apply` | Gửi yêu cầu làm shop (cần JWT) |
| `GET` | `/api/partner/applications/pending` | Danh sách yêu cầu làm shop chờ duyệt (cần JWT Admin) |
| `PUT` | `/api/partner/applications/:userId/:decision` | Duyệt/từ chối yêu cầu (`approve` hoặc `reject`, cần JWT Admin) |

## Kiểm tra frontend

Từ `Hotel-RAG-FE`:

```powershell
npm run lint
npm run build
```

## Lưu ý triển khai

- URL `localhost` chỉ dùng khi frontend và backend chạy trên cùng máy phát triển. Khi deploy, cập nhật `baseURL` frontend thành địa chỉ API thật.
- Không commit `.env`, mật khẩu database, JWT secret hoặc Gemini API key.
- Thanh toán demo chỉ để trình diễn; không kết nối ngân hàng/cổng thanh toán và không xác nhận đã thu tiền thật.
- Booking chỉ tạo được khi tồn kho có đủ bản ghi cho toàn bộ ngày lưu trú. Tạo booking sẽ trừ tồn kho; hiện chưa có cơ chế tự hủy đơn Pending hoặc tự hoàn tồn kho khi khách không thanh toán.
- API booking và lịch sử booking có JWT; các route admin/partner hiện chưa có xác thực/phân quyền server-side đầy đủ.
