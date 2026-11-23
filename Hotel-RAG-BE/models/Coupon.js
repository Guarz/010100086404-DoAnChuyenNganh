// File: models/Coupon.js
// Mã giảm giá. Admin tạo mã toàn sàn (phòng / xe / cả hai); Partner tạo mã cho một khách sạn của mình.
// Khách nhập mã ở trang thanh toán: mỗi lần áp dụng "giữ" 1 lượt (usedCount + 1), trả lại khi đơn bị hủy,
// hết hạn giữ chỗ hoặc khách bỏ mã.
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String, required: true, unique: true, uppercase: true, trim: true,
    match: [/^[A-Z0-9_-]{3,30}$/, 'Mã 3–30 ký tự: chữ không dấu, số, gạch ngang, gạch dưới']
  },
  description: { type: String, trim: true, maxlength: 200 },
  discountType: { type: String, enum: ['percent', 'amount'], required: true },
  value: { type: Number, required: true, min: 1 }, // % (1–100) hoặc số tiền (VND)
  maxDiscount: { type: Number, min: 0 }, // Giảm tối đa (cho mã %), không đặt = không giới hạn
  minOrderAmount: { type: Number, min: 0, default: 0 },
  appliesTo: { type: String, enum: ['hotel', 'transfer', 'all'], default: 'hotel' },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }, // Mã của Partner: chỉ dùng cho KS này
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerRole: { type: String, enum: ['Admin', 'Partner'], required: true },
  startsAt: { type: Date },
  expiresAt: { type: Date },
  usageLimit: { type: Number, min: 1 }, // Tổng lượt dùng, không đặt = không giới hạn
  usedCount: { type: Number, default: 0, min: 0 },
  perUserLimit: { type: Number, min: 1, default: 1 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

couponSchema.index({ createdBy: 1, createdAt: -1 });
couponSchema.index({ hotelId: 1, isActive: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
