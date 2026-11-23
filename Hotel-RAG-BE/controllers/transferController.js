// File: controllers/transferController.js
// Phía KHÁCH HÀNG: tìm xe đưa đón, đặt xe (giữ xe 5 phút chờ thanh toán), xem / hủy đơn.
const mongoose = require('mongoose');
const notifications = require('../services/notificationService');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const TransportCompany = require('../models/TransportCompany');
const VehicleType = require('../models/VehicleType');
const TransferRoute = require('../models/TransferRoute');
const TransferBooking = require('../models/TransferBooking');
const {
  reserveVehicles, cancelPendingTransfer, activeRoutes, findTransferOptions,
  parseVnDateTime, serviceDateOf, parseDateKey, HOLD_MINUTES, DAY_MS
} = require('../services/transferService');

const { VN_PROVINCES, normalizeProvince } = require('../constants/provinces');

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;

// [GET] /api/transfers/provinces - 63 tỉnh/thành (A→Z) kèm số tuyến xe đang bán
exports.getProvinces = async (req, res) => {
  try {
    const counts = new Map();
    for (const { route } of await activeRoutes()) counts.set(route.province, (counts.get(route.province) || 0) + 1);
    const data = VN_PROVINCES.map((name) => ({ name, routeCount: counts.get(name) || 0 }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi tải tỉnh/thành:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách tỉnh/thành' });
  }
};

// [GET] /api/transfers/search?province=|hotelId=&date=YYYY-MM-DD&passengers=
exports.searchTransfers = async (req, res) => {
  try {
    const raw = req.query.province ?? req.query.city; // ?city= cũ vẫn nhận, quy về tỉnh
    let province = raw ? normalizeProvince(String(raw)) : null;
    if (raw && !province) return res.status(400).json({ success: false, message: 'Tỉnh/TP không thuộc danh mục 63 tỉnh thành' });
    if (req.query.hotelId) {
      if (!mongoose.isValidObjectId(req.query.hotelId)) return res.status(400).json({ success: false, message: 'Mã khách sạn không hợp lệ' });
      const hotel = await Hotel.findById(req.query.hotelId).select('address.province hotelName');
      if (!hotel) return res.status(404).json({ success: false, message: 'Không tìm thấy khách sạn' });
      province = hotel.address?.province || province;
    }
    const passengers = Math.max(parseInt(req.query.passengers, 10) || 1, 1);
    const date = parseDateKey(req.query.date);

    const data = await findTransferOptions({ province, date, passengers });

    return res.status(200).json({ success: true, province: province || null, count: data.length, data });
  } catch (error) {
    console.error('Lỗi tìm xe đưa đón:', error);
    return res.status(500).json({ success: false, message: 'Không thể tìm xe lúc này' });
  }
};

const replay = (res, existing, routeId, pickupTime) => {
  if (existing.routeId.toString() !== String(routeId) || existing.pickupTime.getTime() !== pickupTime.getTime()) {
    return res.status(409).json({ success: false, message: 'Idempotency-Key đã được dùng cho một yêu cầu khác' });
  }
  return res.status(200).json({ success: true, replayed: true, message: 'Đơn đã được tạo trước đó', data: existing });
};

// [POST] /api/transfers  Body: { routeId, pickupTime: 'YYYY-MM-DDTHH:mm', passengers, flightNumber?, contactPhone, note?, hotelBookingId? }
exports.createTransfer = async (req, res) => {
  const { routeId, flightNumber, contactPhone, note, hotelBookingId } = req.body;
  const idempotencyKey = req.get('Idempotency-Key');
  if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return res.status(400).json({ success: false, message: 'Idempotency-Key không hợp lệ' });
  }
  if (!mongoose.isValidObjectId(routeId)) return res.status(400).json({ success: false, message: 'Mã tuyến không hợp lệ' });

  const pickupTime = parseVnDateTime(req.body.pickupTime);
  if (!pickupTime) return res.status(400).json({ success: false, message: 'Thời gian đón không hợp lệ' });
  if (pickupTime.getTime() < Date.now() + 60 * 60 * 1000) {
    return res.status(400).json({ success: false, message: 'Vui lòng đặt xe trước giờ đón ít nhất 1 tiếng' });
  }
  if (pickupTime.getTime() > Date.now() + 365 * DAY_MS) {
    return res.status(400).json({ success: false, message: 'Chỉ đặt trước tối đa 1 năm' });
  }
  const passengers = Number(req.body.passengers);
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 100) {
    return res.status(400).json({ success: false, message: 'Số khách phải từ 1 đến 100' });
  }
  if (!/^0\d{9,10}$/.test(String(contactPhone || ''))) {
    return res.status(400).json({ success: false, message: 'Số điện thoại liên hệ không hợp lệ' });
  }

  try {
    if (idempotencyKey) {
      const existing = await TransferBooking.findOne({ customerId: req.user.id, idempotencyKey });
      if (existing) return replay(res, existing, routeId, pickupTime);
    }

    const route = await TransferRoute.findById(routeId);
    const vehicle = route && await VehicleType.findById(route.vehicleTypeId);
    const company = route && await TransportCompany.findById(route.companyId);
    if (!route || route.isActive === false || !vehicle || vehicle.isActive === false || company?.status !== 'Approved') {
      return res.status(404).json({ success: false, message: 'Tuyến xe không còn hoạt động' });
    }

    // Đơn phòng đi kèm phải là của chính khách
    if (hotelBookingId) {
      if (!mongoose.isValidObjectId(hotelBookingId)) return res.status(400).json({ success: false, message: 'Mã đơn phòng không hợp lệ' });
      const hotelBooking = await Booking.findOne({ _id: hotelBookingId, customerId: req.user.id }).select('_id');
      if (!hotelBooking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn phòng đi kèm' });
    }

    const vehicles = Math.ceil(passengers / vehicle.seats);
    const serviceDate = serviceDateOf(pickupTime);
    const booking = new TransferBooking({
      customerId: req.user.id,
      companyId: company._id,
      routeId: route._id,
      vehicleTypeId: vehicle._id,
      hotelBookingId: hotelBookingId || undefined,
      pickupTime, serviceDate, passengers, vehicles,
      flightNumber: typeof flightNumber === 'string' ? flightNumber.trim().slice(0, 20) : undefined,
      contactPhone: String(contactPhone),
      note: typeof note === 'string' ? note.trim().slice(0, 500) : undefined,
      unitPrice: route.price,
      totalAmount: route.price * vehicles,
      expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
      idempotencyKey
    });

    // Lưu đơn TRƯỚC để unique index {customerId, idempotencyKey} "chiếm" khóa: request trùng gửi đồng thời
    // sẽ nhận lỗi 11000 và trả lại đơn cũ thay vì tranh giữ thêm xe.
    try {
      await booking.save();
    } catch (saveError) {
      if (saveError.code === 11000 && idempotencyKey) {
        const existing = await TransferBooking.findOne({ customerId: req.user.id, idempotencyKey });
        if (existing) return replay(res, existing, routeId, pickupTime);
      }
      throw saveError;
    }

    // Giữ xe nguyên tử; hết xe -> xóa đơn vừa tạo
    const reserved = await reserveVehicles(vehicle._id, serviceDate, vehicles).catch(async (error) => {
      await TransferBooking.deleteOne({ _id: booking._id });
      throw error;
    });
    if (!reserved) {
      await TransferBooking.deleteOne({ _id: booking._id });
      return res.status(400).json({ success: false, message: `Hết xe ${vehicle.name} vào ngày ${pickupTime.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` });
    }

    return res.status(201).json({ success: true, message: 'Đã giữ xe trong 5 phút, vui lòng thanh toán', data: booking });
  } catch (error) {
    console.error('Lỗi đặt xe đưa đón:', error);
    return res.status(500).json({ success: false, message: 'Không thể đặt xe lúc này' });
  }
};

const populateTransfer = (query) => query
  .populate('routeId', 'province fromPlace toPlace durationMin')
  .populate('vehicleTypeId', 'name seats luggage images')
  .populate('companyId', 'companyName phone');

// [GET] /api/transfers/my - lịch sử đặt xe của khách
exports.getMyTransfers = async (req, res) => {
  try {
    const transfers = await populateTransfer(TransferBooking.find({
      customerId: req.user.id, status: { $in: ['Confirmed', 'Completed', 'Canceled'] }
    }).sort({ pickupTime: -1 })).lean();
    const payments = await Payment.find({ transferBookingId: { $in: transfers.map((t) => t._id) }, paymentStatus: 'Success' }).lean();
    const paid = new Set(payments.map((p) => p.transferBookingId.toString()));
    return res.status(200).json({ success: true, data: transfers.map((t) => ({ ...t, paid: paid.has(t._id.toString()) })) });
  } catch (error) {
    console.error('Lỗi tải lịch sử đặt xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải lịch sử đặt xe' });
  }
};

// [GET] /api/transfers/:id - chi tiết đơn (trang thanh toán)
exports.getTransferById = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt xe' });
  try {
    const booking = await populateTransfer(TransferBooking.findOne({ _id: req.params.id, customerId: req.user.id }));
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt xe' });
    if (booking.status === 'Pending' && booking.expiresAt <= new Date()) {
      await cancelPendingTransfer({ _id: booking._id });
      return res.status(410).json({ success: false, message: 'Đơn đặt xe đã hết thời gian giữ chỗ và được hủy. Vui lòng đặt lại.' });
    }
    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('Lỗi tải đơn đặt xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải đơn đặt xe' });
  }
};

// [PUT] /api/transfers/:id/cancel - hủy đơn chưa thanh toán, trả xe
exports.cancelTransfer = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt xe' });
  try {
    const booking = await TransferBooking.findOne({ _id: req.params.id, customerId: req.user.id }).select('status');
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt xe' });
    if (booking.status !== 'Pending') return res.status(400).json({ success: false, message: 'Chỉ hủy được đơn chưa thanh toán' });
    const canceled = await cancelPendingTransfer({ _id: booking._id, customerId: req.user.id });
    if (!canceled) return res.status(409).json({ success: false, message: 'Đơn đã được xử lý trước đó' });
    await notifications.notifyOrderCanceledByCustomer('transfer', canceled);
    return res.status(200).json({ success: true, message: 'Đã hủy đơn đặt xe' });
  } catch (error) {
    console.error('Lỗi hủy đơn đặt xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể hủy đơn lúc này' });
  }
};
