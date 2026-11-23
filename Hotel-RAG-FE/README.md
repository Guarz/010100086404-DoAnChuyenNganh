# Nestly — Frontend (React + Vite)

Giao diện web của Nestly: đặt phòng khách sạn, xe đưa đón, trợ lý AI (RAG). Hướng dẫn đầy đủ của dự án ở [README gốc](../README.md).

## Chạy

```powershell
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build    # ra thư mục dist/
```

Địa chỉ API đặt bằng biến `VITE_API_URL` trong file `.env` (mẫu: `.env.example`). Không đặt thì mặc định `http://localhost:5000/api`.

## Công nghệ

React 19, React Router 7, Tailwind CSS 3, Axios. Biểu đồ tự vẽ bằng SVG (`src/components/charts/BarChart.jsx`), không dùng thư viện biểu đồ.

## Trang chính

| Đường dẫn | Trang |
| --- | --- |
| `/`, `/hotels`, `/hotels/:id` | Trang chủ, danh sách / lọc khách sạn, chi tiết khách sạn |
| `/transfers`, `/transfer-checkout/:id` | Tìm và thanh toán xe đưa đón (nhận `?province=&date=&passengers=`) |
| `/checkout/:id` | Thanh toán đơn phòng (mã giảm giá, VNPay / MoMo) |
| `/payment/vnpay-return`, `/payment/momo-return` | Kết quả thanh toán |
| `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` | Tài khoản |
| `/profile` | Hồ sơ, lịch sử đặt chỗ, yêu thích (`?tab=`) |
| `/partner-apply`, `/partner` | Đăng ký / trung tâm đối tác (khách sạn, mã giảm giá, thống kê) |
| `/transport-apply`, `/transport` | Đăng ký / trung tâm nhà xe |
| `/admin`, `/admin/rag` | Quản trị (`?tab=`), chỉ số RAG |

## Thành phần đáng chú ý

- `components/AIChatWidget.jsx`: khung chat trợ lý AI; hiện nhãn ràng buộc đã hiểu, thẻ phòng `[n]` và thẻ xe đưa đón `[Xn]`.
- `components/NotificationBell.jsx`: chuông thông báo (cập nhật mỗi 60 giây).
- `components/WishlistButton.jsx`, `hooks/useWishlist.js`: danh sách yêu thích dùng chung mọi trang.
- `components/CouponBox.jsx`, `components/PaymentButtons.jsx`: áp mã giảm giá, chọn VNPay / MoMo.
- `components/StatsPanel.jsx`: biểu đồ doanh thu, tỷ lệ lấp phòng, xuất báo cáo (Admin).
- `constants/provinces.js`: 63 tỉnh/thành, phải giống hệt bản ở backend (có test kiểm tra).
