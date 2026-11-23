// File: services/couponService.js
// Kiểm tra / tính tiền giảm / giữ và trả lượt dùng mã giảm giá cho đơn phòng và đơn xe.
const Coupon = require('../models/Coupon');

// Số tiền tối thiểu phải thanh toán sau khi giảm (VNPay không nhận giao dịch quá nhỏ)
const MIN_PAYABLE = 10000;

class CouponError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const normalizeCode = (code) => (typeof code === 'string' ? code.trim().toUpperCase() : '');

// Số tiền được giảm cho một đơn có giá trị amount
const computeDiscount = (coupon, amount) => {
  let discount = coupon.discountType === 'percent'
    ? Math.floor((amount * coupon.value) / 100)
    : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, Math.max(0, amount - MIN_PAYABLE));
  return Math.max(0, Math.round(discount / 1000) * 1000); // làm tròn nghìn đồng
};

// Kiểm tra mã có dùng được cho đơn không (chưa giữ lượt). kind: 'hotel' | 'transfer'
// countUserUses: hàm async trả số đơn (chưa hủy) của khách đã dùng mã này, trừ đơn hiện tại
async function validateCoupon({ code, kind, hotelId, amount, countUserUses }) {
  const normalized = normalizeCode(code);
  if (!normalized) throw new CouponError('Vui lòng nhập mã giảm giá');
  const coupon = await Coupon.findOne({ code: normalized });
  const now = new Date();
  if (!coupon || !coupon.isActive) throw new CouponError('Mã giảm giá không tồn tại hoặc đã ngừng áp dụng');
  if (coupon.startsAt && coupon.startsAt > now) throw new CouponError('Mã giảm giá chưa đến thời gian áp dụng');
  if (coupon.expiresAt && coupon.expiresAt < now) throw new CouponError('Mã giảm giá đã hết hạn');
  if (coupon.appliesTo !== 'all' && coupon.appliesTo !== kind) {
    throw new CouponError(kind === 'hotel' ? 'Mã này chỉ dùng cho đơn đặt xe đưa đón' : 'Mã này chỉ dùng cho đơn đặt phòng');
  }
  if (coupon.hotelId && String(coupon.hotelId) !== String(hotelId)) {
    throw new CouponError('Mã này chỉ áp dụng cho một khách sạn khác');
  }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new CouponError('Mã giảm giá đã hết lượt sử dụng');
  if (amount < (coupon.minOrderAmount || 0)) {
    throw new CouponError(`Đơn tối thiểu ${coupon.minOrderAmount.toLocaleString('vi-VN')}₫ để dùng mã này`);
  }
  if (countUserUses && (await countUserUses(coupon._id)) >= (coupon.perUserLimit || 1)) {
    throw new CouponError('Bạn đã dùng hết lượt của mã này');
  }
  const discount = computeDiscount(coupon, amount);
  if (discount <= 0) throw new CouponError('Đơn này không đủ điều kiện để giảm thêm');
  return { coupon, discount };
}

// Giữ 1 lượt (nguyên tử: chỉ tăng khi còn lượt và mã còn hiệu lực)
async function reserveUse(couponId) {
  const res = await Coupon.updateOne(
    {
      _id: couponId, isActive: true,
      $or: [{ usageLimit: { $exists: false } }, { usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }]
    },
    { $inc: { usedCount: 1 } }
  );
  if (!res.modifiedCount) throw new CouponError('Mã giảm giá vừa hết lượt sử dụng', 409);
}

// Trả lại 1 lượt khi đơn hủy / hết hạn / khách bỏ mã
async function releaseUse(couponId) {
  if (!couponId) return;
  await Coupon.updateOne({ _id: couponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
}

module.exports = { validateCoupon, reserveUse, releaseUse, computeDiscount, normalizeCode, CouponError, MIN_PAYABLE };
