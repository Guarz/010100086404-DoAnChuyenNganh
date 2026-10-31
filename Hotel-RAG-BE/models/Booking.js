// File: models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  
  checkInDate: { type: Date, required: true },
  checkOutDate: { type: Date, required: true },
  expiresAt: { type: Date },
  totalAmount: { type: Number, required: true },
  specialRequests: { type: String },
  // Khóa chống trùng do client gửi (header Idempotency-Key): bấm 2 lần / mạng gửi lại
  // cùng một yêu cầu thì chỉ tạo đúng 1 đơn và chỉ trừ quỹ phòng 1 lần.
  idempotencyKey: { type: String },
  
  bookingStatus: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Canceled', 'Completed'],
    default: 'Pending'
  },
  
  // Nhúng mảng BookingDetail trực tiếp vào đây
  bookingDetails: [{
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
    quantity: { type: Number, required: true, min: 1 }, // Số lượng phòng khách đặt
    unitPrice: { type: Number, required: true }, // Giá chốt tại thời điểm đặt (để sau này giá phòng tăng thì bill không bị đổi)
    totalNights: { type: Number, required: true }
  }]
}, { timestamps: true }); 
// timestamps tự động tạo createdAt (chính là BookingDate) và updatedAt

// KHÔNG dùng TTL index: nếu MongoDB tự xóa đơn Pending thì quỹ phòng đã trừ sẽ không bao giờ được hoàn lại.
// Cronjob (jobs/bookingCron.js) sẽ quét đơn hết hạn, chuyển sang Canceled và trả quỹ phòng.
bookingSchema.index({ bookingStatus: 1, expiresAt: 1 });
bookingSchema.index({ hotelId: 1, checkInDate: 1 });
bookingSchema.index(
  { customerId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = mongoose.model('Booking', bookingSchema);