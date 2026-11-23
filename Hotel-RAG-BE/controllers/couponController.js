// File: controllers/couponController.js
// Quản lý mã giảm giá (Admin: toàn sàn, Partner: khách sạn của mình) và áp / bỏ mã cho đơn đang chờ thanh toán.
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const TransferBooking = require('../models/TransferBooking');
const { validateCoupon, reserveUse, releaseUse, normalizeCode, CouponError } = require('../services/couponService');

const TARGETS = {
  hotel: { Model: Booking, statusField: 'bookingStatus', label: 'đơn đặt phòng' },
  transfer: { Model: TransferBooking, statusField: 'status', label: 'đơn đặt xe' }
};

const toNumber = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
const toDate = (v) => (v ? new Date(v) : undefined);

// Đọc + kiểm tra dữ liệu mã từ body (dùng cho tạo mới)
function readCouponInput(body) {
  const data = {
    code: normalizeCode(body.code),
    description: typeof body.description === 'string' ? body.description.trim().slice(0, 200) : undefined,
    discountType: body.discountType,
    value: toNumber(body.value),
    maxDiscount: toNumber(body.maxDiscount),
    minOrderAmount: toNumber(body.minOrderAmount) || 0,
    appliesTo: body.appliesTo || 'hotel',
    startsAt: toDate(body.startsAt),
    expiresAt: toDate(body.expiresAt),
    usageLimit: toNumber(body.usageLimit),
    perUserLimit: toNumber(body.perUserLimit) || 1
  };
  if (!/^[A-Z0-9_-]{3,30}$/.test(data.code)) throw new CouponError('Mã 3–30 ký tự: chữ không dấu, số, gạch ngang, gạch dưới');
  if (!['percent', 'amount'].includes(data.discountType)) throw new CouponError('Chọn kiểu giảm: theo % hoặc số tiền');
  if (!Number.isFinite(data.value) || data.value <= 0) throw new CouponError('Giá trị giảm phải lớn hơn 0');
  if (data.discountType === 'percent' && data.value > 100) throw new CouponError('Giảm theo % tối đa 100%');
  if (data.discountType === 'amount' && data.value < 1000) throw new CouponError('Số tiền giảm tối thiểu 1.000₫');
  if (!['hotel', 'transfer', 'all'].includes(data.appliesTo)) throw new CouponError('Phạm vi áp dụng không hợp lệ');
  for (const k of ['maxDiscount', 'minOrderAmount', 'usageLimit', 'perUserLimit']) {
    if (data[k] !== undefined && (!Number.isFinite(data[k]) || data[k] < 0)) throw new CouponError('Các giá trị số phải là số không âm');
  }
  if ([data.startsAt, data.expiresAt].some((d) => d && Number.isNaN(d.getTime()))) throw new CouponError('Ngày không hợp lệ');
  if (data.startsAt && data.expiresAt && data.expiresAt <= data.startsAt) throw new CouponError('Ngày hết hạn phải sau ngày bắt đầu');
  return data;
}

const handleError = (res, error, fallback) => {
  if (error instanceof CouponError) return res.status(error.status).json({ success: false, message: error.message });
  if (error.code === 11000) return res.status(409).json({ success: false, message: 'Mã này đã tồn tại, hãy chọn mã khác' });
  if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: Object.values(error.errors)[0].message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
};

// Chỉ người tạo (Partner) hoặc Admin được sửa / xóa mã
const canManage = (coupon, user) => user.role === 'Admin' || String(coupon.createdBy) === String(user.id);

// [GET] /api/coupons - Admin: mọi mã; Partner: mã của mình
exports.listCoupons = async (req, res) => {
  try {
    const filter = req.user.role === 'Admin' ? {} : { createdBy: req.user.id };
    const coupons = await Coupon.find(filter).sort({ createdAt: -1 }).populate('hotelId', 'hotelName').lean();
    return res.status(200).json({ success: true, data: coupons });
  } catch (error) {
    return handleError(res, error, 'Không thể tải danh sách mã giảm giá');
  }
};

// [POST] /api/coupons
exports.createCoupon = async (req, res) => {
  try {
    const data = readCouponInput(req.body);
    if (req.user.role === 'Partner') {
      // Partner: bắt buộc chọn 1 khách sạn của mình đã được duyệt, mã chỉ dùng cho đặt phòng
      if (!mongoose.isValidObjectId(req.body.hotelId)) throw new CouponError('Chọn khách sạn áp dụng mã');
      const hotel = await Hotel.findOne({ _id: req.body.hotelId, partnerId: req.user.id, status: 'Approved' }).select('_id');
      if (!hotel) throw new CouponError('Chỉ tạo được mã cho khách sạn đã duyệt của bạn', 403);
      data.hotelId = hotel._id;
      data.appliesTo = 'hotel';
    }
    const coupon = await Coupon.create({ ...data, createdBy: req.user.id, ownerRole: req.user.role === 'Admin' ? 'Admin' : 'Partner' });
    return res.status(201).json({ success: true, message: `Đã tạo mã ${coupon.code}`, data: coupon });
  } catch (error) {
    return handleError(res, error, 'Không thể tạo mã giảm giá');
  }
};

// [PUT] /api/coupons/:id - bật/tắt, đổi mô tả, hạn dùng, giới hạn lượt
exports.updateCoupon = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Không tìm thấy mã' });
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon || !canManage(coupon, req.user)) return res.status(404).json({ success: false, message: 'Không tìm thấy mã' });
    const { isActive, description, expiresAt, usageLimit } = req.body;
    if (typeof isActive === 'boolean') coupon.isActive = isActive;
    if (typeof description === 'string') coupon.description = description.trim().slice(0, 200);
    if (expiresAt !== undefined) coupon.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
    if (usageLimit !== undefined) {
      const n = toNumber(usageLimit);
      if (n !== undefined && (!Number.isFinite(n) || n < coupon.usedCount)) {
        throw new CouponError(`Giới hạn lượt không được nhỏ hơn số lượt đã dùng (${coupon.usedCount})`);
      }
      coupon.usageLimit = n;
    }
    await coupon.save();
    return res.status(200).json({ success: true, message: 'Đã cập nhật mã giảm giá', data: coupon });
  } catch (error) {
    return handleError(res, error, 'Không thể cập nhật mã giảm giá');
  }
};

// [DELETE] /api/coupons/:id - chỉ xóa được mã chưa ai dùng (đã dùng thì tắt đi để giữ lịch sử đơn)
exports.deleteCoupon = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Không tìm thấy mã' });
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon || !canManage(coupon, req.user)) return res.status(404).json({ success: false, message: 'Không tìm thấy mã' });
    if (coupon.usedCount > 0) {
      return res.status(409).json({ success: false, message: 'Mã đã có người dùng, hãy tắt mã thay vì xóa' });
    }
    await coupon.deleteOne();
    return res.status(200).json({ success: true, message: `Đã xóa mã ${coupon.code}` });
  } catch (error) {
    return handleError(res, error, 'Không thể xóa mã giảm giá');
  }
};

// [GET] /api/coupons/available?kind=hotel|transfer&hotelId= - mã đang dùng được (hiện gợi ý cho khách)
exports.availableCoupons = async (req, res) => {
  try {
    const kind = req.query.kind === 'transfer' ? 'transfer' : 'hotel';
    const now = new Date();
    const scope = [{ hotelId: { $exists: false } }, { hotelId: null }];
    if (kind === 'hotel' && mongoose.isValidObjectId(req.query.hotelId)) scope.push({ hotelId: req.query.hotelId });
    const coupons = await Coupon.find({
      isActive: true,
      appliesTo: { $in: [kind, 'all'] },
      $and: [
        { $or: scope },
        { $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }] },
        { $or: [{ usageLimit: { $exists: false } }, { usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] }
      ]
    }).select('code description discountType value maxDiscount minOrderAmount expiresAt hotelId').sort({ value: -1 }).limit(10).lean();
    return res.status(200).json({ success: true, data: coupons });
  } catch (error) {
    return handleError(res, error, 'Không thể tải mã giảm giá');
  }
};

// Đếm số đơn (chưa hủy) của khách đã dùng mã, không tính đơn đang áp mã
const countUserUses = (userId, exceptId) => async (couponId) => {
  const [a, b] = await Promise.all([
    Booking.countDocuments({ customerId: userId, 'coupon.couponId': couponId, bookingStatus: { $ne: 'Canceled' }, _id: { $ne: exceptId } }),
    TransferBooking.countDocuments({ customerId: userId, 'coupon.couponId': couponId, status: { $ne: 'Canceled' }, _id: { $ne: exceptId } })
  ]);
  return a + b;
};

// Đơn của khách, đang chờ thanh toán và còn hạn giữ chỗ
async function loadPendingOrder(kind, id, userId) {
  const { Model, statusField, label } = TARGETS[kind];
  if (!mongoose.isValidObjectId(id)) throw new CouponError(`Không tìm thấy ${label}`, 404);
  const order = await Model.findOne({ _id: id, customerId: userId });
  if (!order) throw new CouponError(`Không tìm thấy ${label}`, 404);
  if (order[statusField] !== 'Pending') throw new CouponError('Chỉ áp mã cho đơn đang chờ thanh toán');
  if (order.expiresAt && order.expiresAt <= new Date()) throw new CouponError('Đơn đã hết thời gian giữ chỗ', 410);
  return order;
}

const orderSummary = (order) => ({
  subtotalAmount: order.subtotalAmount ?? order.totalAmount,
  totalAmount: order.totalAmount,
  coupon: order.coupon?.couponId ? { code: order.coupon.code, discountAmount: order.coupon.discountAmount } : null
});

// [PUT] /api/bookings/:id/coupon và /api/transfers/:id/coupon  { code }
exports.applyCoupon = (kind) => async (req, res) => {
  try {
    const { Model, statusField } = TARGETS[kind];
    const order = await loadPendingOrder(kind, req.params.id, req.user.id);
    const subtotal = order.subtotalAmount ?? order.totalAmount;
    const oldCouponId = order.coupon?.couponId;
    if (oldCouponId && order.coupon.code === normalizeCode(req.body.code)) {
      return res.status(200).json({ success: true, message: 'Mã đã được áp dụng', data: orderSummary(order) });
    }
    const { coupon, discount } = await validateCoupon({
      code: req.body.code, kind, hotelId: kind === 'hotel' ? order.hotelId : null, amount: subtotal,
      countUserUses: countUserUses(req.user.id, order._id)
    });

    await reserveUse(coupon._id);
    // Ghi vào đơn có điều kiện: đơn vẫn Pending và chưa bị đổi mã bởi request khác
    const updated = await Model.findOneAndUpdate(
      { _id: order._id, [statusField]: 'Pending', 'coupon.couponId': oldCouponId || { $exists: false } },
      {
        $set: {
          subtotalAmount: subtotal,
          totalAmount: subtotal - discount,
          coupon: { couponId: coupon._id, code: coupon.code, discountAmount: discount }
        }
      },
      { returnDocument: 'after' }
    );
    if (!updated) {
      await releaseUse(coupon._id);
      throw new CouponError('Đơn vừa thay đổi, vui lòng thử lại', 409);
    }
    if (oldCouponId) await releaseUse(oldCouponId);
    return res.status(200).json({
      success: true,
      message: `Đã áp dụng mã ${coupon.code}: giảm ${discount.toLocaleString('vi-VN')}₫`,
      data: orderSummary(updated)
    });
  } catch (error) {
    return handleError(res, error, 'Không thể áp dụng mã giảm giá');
  }
};

// [DELETE] /api/bookings/:id/coupon và /api/transfers/:id/coupon
exports.removeCoupon = (kind) => async (req, res) => {
  try {
    const { Model, statusField } = TARGETS[kind];
    const order = await loadPendingOrder(kind, req.params.id, req.user.id);
    if (!order.coupon?.couponId) return res.status(200).json({ success: true, message: 'Đơn chưa áp mã', data: orderSummary(order) });
    const updated = await Model.findOneAndUpdate(
      { _id: order._id, [statusField]: 'Pending', 'coupon.couponId': order.coupon.couponId },
      { $set: { totalAmount: order.subtotalAmount ?? order.totalAmount }, $unset: { coupon: 1 } },
      { returnDocument: 'after' }
    );
    if (!updated) throw new CouponError('Đơn vừa thay đổi, vui lòng thử lại', 409);
    await releaseUse(order.coupon.couponId);
    return res.status(200).json({ success: true, message: 'Đã bỏ mã giảm giá', data: orderSummary(updated) });
  } catch (error) {
    return handleError(res, error, 'Không thể bỏ mã giảm giá');
  }
};
