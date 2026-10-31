# Chống oversell khi đặt phòng đồng thời

> Trả lời góp ý **#5 – Booking concurrency**.

## 1. Cơ chế

| Vấn đề | Cách xử lý | Code |
|---|---|---|
| 2 request cùng lúc tranh phòng cuối cùng | **Atomic conditional update** cho từng đêm: `updateOne({ _id, availableRooms: { $gte: qty } }, { $inc: { availableRooms: -qty } })`. MongoDB thực hiện kiểm tra + trừ trong một thao tác nguyên tử trên document, nên chỉ 1 request thắng; request còn lại nhận `modifiedCount = 0`. | `services/inventoryService.js` → `reserveInventory` |
| Đặt nhiều đêm, đêm sau hết phòng | **Rollback bù trừ (compensating transaction)**: nếu bất kỳ đêm nào thất bại, cộng trả lại các đêm đã trừ trước khi báo lỗi. Lưu đơn thất bại cũng hoàn quỹ. | `reserveInventory`, `bookingController.createBooking` |
| Bấm "Xác nhận đặt" 2 lần / mạng gửi lại | **Idempotency-Key**: frontend sinh `crypto.randomUUID()` cho mỗi lần đặt; backend có unique index `{ customerId, idempotencyKey }`. Gửi lại → trả đơn cũ (200, `replayed: true`), không trừ quỹ lần 2. Dùng lại key cho yêu cầu khác → 409. | `models/Booking.js`, `bookingController`, `HotelDetail.jsx` |
| Hoàn quỹ 2 lần (khách hủy + cronjob + VNPay cùng lúc) | Chuyển trạng thái bằng `findOneAndUpdate({ bookingStatus: 'Pending' })`: chỉ một tiến trình đổi được trạng thái và hoàn quỹ. | `inventoryService.cancelPendingBooking` |
| Đơn không thanh toán giữ phòng mãi | Cronjob mỗi phút hủy đơn Pending quá 5 phút và hoàn quỹ; link VNPay hết hạn cùng lúc. | `jobs/bookingCron.js` |

**Vì sao không dùng multi-document transaction?** Mỗi đêm là một document độc lập và điều kiện "còn đủ phòng" được kiểm tra nguyên tử trên chính document đó, nên không xảy ra oversell. Phần cần nhiều document (nhiều đêm) được bảo đảm bằng rollback bù trừ. Transaction của MongoDB (Atlas replica set hỗ trợ) là phương án thay thế nếu muốn rollback do DB đảm nhiệm.

## 2. Minh chứng: test đồng thời

`Hotel-RAG-BE/tests/booking-concurrency.test.js` (chạy `npm test`) in trạng thái DB trước/sau:

```
[minh chứng] stock trước=1, kết quả=201,400, stock sau=0          ← 2 khách cùng đặt phòng cuối
[minh chứng] 10 request -> 3 thành công, stock sau=0               ← stock = 3, 10 request song song
[minh chứng] quỹ 3 đêm trước=2,0,2, status=400, sau=2,0,2         ← rollback khi đêm 2 hết phòng
[minh chứng] status=201,200, stock sau=4                           ← cùng Idempotency-Key gửi 2 lần song song
```

Ngoài ra test: hủy đơn 2 lần chỉ hoàn quỹ 1 lần; 2 lượt cronjob chạy chồng nhau chỉ hoàn quỹ 1 lần.
