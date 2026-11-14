// File: models/TransferBooking.js
// Đơn đặt xe đưa đón. Luồng trạng thái giống đơn phòng:
// Pending (giữ xe 5 phút chờ thanh toán) -> Confirmed (đã thanh toán) -> Completed (đã đưa đón) | Canceled
const mongoose = require('mongoose');

const transferBookingSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportCompany', required: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransferRoute', required: true },
  vehicleTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleType', required: true },
  hotelBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }, // Đơn phòng đi kèm (không bắt buộc)

  pickupTime: { type: Date, required: true }, // Thời điểm đón khách
  serviceDate: { type: Date, required: true }, // Ngày đón (00:00 UTC) - khóa để trừ VehicleInventory
  passengers: { type: Number, required: true, min: 1 },
  vehicles: { type: Number, required: true, min: 1, default: 1 }, // Số xe đặt
  flightNumber: { type: String }, // Số hiệu chuyến bay (nếu đón ở sân bay)
  contactPhone: { type: String, required: true },
  note: { type: String },

  unitPrice: { type: Number, required: true }, // Giá mỗi xe chốt lúc đặt
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Canceled', 'Completed'],
    default: 'Pending'
  },
  expiresAt: { type: Date }, // Hạn giữ xe khi Pending
  idempotencyKey: { type: String } // Chống đặt trùng khi bấm 2 lần / mạng gửi lại
}, { timestamps: true });

transferBookingSchema.index({ status: 1, expiresAt: 1 });
transferBookingSchema.index({ companyId: 1, pickupTime: 1 });
transferBookingSchema.index(
  { customerId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = mongoose.model('TransferBooking', transferBookingSchema);
