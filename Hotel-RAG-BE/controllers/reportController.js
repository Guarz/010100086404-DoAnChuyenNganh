// File: controllers/reportController.js
// Thống kê doanh thu / tỷ lệ lấp phòng (Partner: khách sạn của mình, Admin: toàn sàn)
// và xuất báo cáo đơn đặt + doanh thu ra Excel (.xlsx) / CSV cho Admin.
const ExcelJS = require('exceljs');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const TransferBooking = require('../models/TransferBooking');
const Payment = require('../models/Payment');
const { hotelStats, transferRevenue } = require('../services/statsService');

const MAX_ROWS = 5000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

const STATUS_VI = { Pending: 'Chờ thanh toán', Confirmed: 'Đã thanh toán', Completed: 'Hoàn thành', Canceled: 'Đã hủy' };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
const stayDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : ''); // ngày lưu trú lưu dạng 00:00 UTC

// [GET] /api/partner/stats?months=6
exports.partnerStats = async (req, res) => {
  try {
    const hotels = await Hotel.find(req.user.role === 'Admin' ? {} : { partnerId: req.user.id }).select('_id hotelName').lean();
    const stats = await hotelStats({ hotelIds: hotels.map((h) => h._id), months: req.query.months });
    const names = new Map(hotels.map((h) => [String(h._id), h.hotelName]));
    stats.byHotel = stats.byHotel.map((h) => ({ ...h, hotelName: names.get(h.hotelId) || '' })).sort((a, b) => b.occupancyRate - a.occupancyRate);
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('Lỗi thống kê Partner:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải thống kê' });
  }
};

// [GET] /api/admin/stats?months=6 - toàn sàn: phòng + xe
exports.adminStats = async (req, res) => {
  try {
    const [hotel, transfer] = await Promise.all([hotelStats({ months: req.query.months }), transferRevenue({ months: req.query.months })]);
    const months = hotel.months.map((m, i) => ({
      ...m,
      hotelRevenue: m.revenue,
      transferRevenue: transfer[i].revenue,
      transferOrders: transfer[i].orders,
      revenue: m.revenue + transfer[i].revenue
    }));
    const names = new Map((await Hotel.find({}).select('hotelName').lean()).map((h) => [String(h._id), h.hotelName]));
    return res.status(200).json({
      success: true,
      data: {
        months,
        totals: { ...hotel.totals, hotelRevenue: hotel.totals.revenue, transferRevenue: transfer.reduce((s, m) => s + m.revenue, 0), revenue: hotel.totals.revenue + transfer.reduce((s, m) => s + m.revenue, 0) },
        byHotel: hotel.byHotel.map((h) => ({ ...h, hotelName: names.get(h.hotelId) || '' })).sort((a, b) => b.occupancyRate - a.occupancyRate)
      }
    });
  } catch (error) {
    console.error('Lỗi thống kê Admin:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải thống kê' });
  }
};

// Khoảng ngày lọc theo ngày đặt (giờ VN). from/to dạng YYYY-MM-DD, mặc định 90 ngày gần nhất
function readRange(query) {
  const parse = (s, endOfDay) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + (endOfDay ? 1 : 0)) - VN_OFFSET_MS);
  };
  const to = parse(query.to, true) || new Date();
  const from = parse(query.from, false) || new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  if (from >= to) throw new Error('Khoảng ngày không hợp lệ');
  return { from, to };
}

// Lấy dữ liệu báo cáo: đơn phòng + đơn xe + thanh toán thành công
async function loadReport({ from, to }) {
  const [bookings, transfers] = await Promise.all([
    Booking.find({ createdAt: { $gte: from, $lt: to } }).sort({ createdAt: -1 }).limit(MAX_ROWS)
      .populate('customerId', 'fullName username email phone')
      .populate('hotelId', 'hotelName address')
      .lean(),
    TransferBooking.find({ createdAt: { $gte: from, $lt: to } }).sort({ createdAt: -1 }).limit(MAX_ROWS)
      .populate('customerId', 'fullName username email phone')
      .populate('companyId', 'companyName')
      .populate('routeId', 'fromPlace toPlace province')
      .lean()
  ]);
  const payments = await Payment.find({
    paymentStatus: 'Success',
    $or: [{ bookingId: { $in: bookings.map((b) => b._id) } }, { transferBookingId: { $in: transfers.map((t) => t._id) } }]
  }).lean();
  const paidBy = new Map(payments.map((p) => [String(p.bookingId || p.transferBookingId), p]));

  const customer = (c) => (c ? `${c.fullName || ''}${c.username ? ` (@${c.username})` : ''}` : '');
  const hotelRows = bookings.map((b) => {
    const pay = paidBy.get(String(b._id));
    const nights = b.bookingDetails?.[0]?.totalNights || 0;
    return {
      code: String(b._id).slice(-8).toUpperCase(), createdAt: fmtDateTime(b.createdAt),
      customer: customer(b.customerId), email: b.customerId?.email || '', phone: b.customerId?.phone || '',
      hotel: b.hotelId?.hotelName || '', province: b.hotelId?.address?.province || '',
      checkIn: stayDate(b.checkInDate), checkOut: stayDate(b.checkOutDate), nights,
      rooms: (b.bookingDetails || []).reduce((s, d) => s + (d.quantity || 0), 0),
      subtotal: b.subtotalAmount ?? b.totalAmount, coupon: b.coupon?.code || '', discount: b.coupon?.discountAmount || 0,
      total: b.totalAmount, status: STATUS_VI[b.bookingStatus] || b.bookingStatus,
      method: pay?.paymentMethod || '', paidAt: fmtDateTime(pay?.paymentDate)
    };
  });
  const transferRows = transfers.map((t) => {
    const pay = paidBy.get(String(t._id));
    return {
      code: String(t._id).slice(-8).toUpperCase(), createdAt: fmtDateTime(t.createdAt),
      customer: customer(t.customerId), email: t.customerId?.email || '', phone: t.contactPhone || '',
      company: t.companyId?.companyName || '',
      route: t.routeId ? `${t.routeId.fromPlace} → ${t.routeId.toPlace}` : '', province: t.routeId?.province || '',
      pickup: fmtDateTime(t.pickupTime), passengers: t.passengers, vehicles: t.vehicles,
      subtotal: t.subtotalAmount ?? t.totalAmount, coupon: t.coupon?.code || '', discount: t.coupon?.discountAmount || 0,
      total: t.totalAmount, status: STATUS_VI[t.status] || t.status,
      method: pay?.paymentMethod || '', paidAt: fmtDateTime(pay?.paymentDate)
    };
  });
  // Doanh thu theo tháng của các giao dịch thành công trong kỳ
  const monthly = new Map();
  for (const p of payments) {
    const key = new Date(new Date(p.paymentDate || p.createdAt).getTime() + VN_OFFSET_MS).toISOString().slice(0, 7);
    const row = monthly.get(key) || { month: key, hotelRevenue: 0, hotelOrders: 0, transferRevenue: 0, transferOrders: 0 };
    if (p.bookingId) { row.hotelRevenue += p.amount; row.hotelOrders += 1; } else { row.transferRevenue += p.amount; row.transferOrders += 1; }
    monthly.set(key, row);
  }
  const monthlyRows = [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ ...r, month: `${r.month.slice(5)}/${r.month.slice(0, 4)}`, total: r.hotelRevenue + r.transferRevenue }));
  return { hotelRows, transferRows, monthlyRows };
}

const HOTEL_COLUMNS = [
  ['code', 'Mã đơn', 12], ['createdAt', 'Ngày đặt', 20], ['customer', 'Khách hàng', 28], ['email', 'Email', 28], ['phone', 'SĐT', 14],
  ['hotel', 'Khách sạn', 32], ['province', 'Tỉnh/TP', 16], ['checkIn', 'Nhận phòng', 12], ['checkOut', 'Trả phòng', 12],
  ['nights', 'Số đêm', 8], ['rooms', 'Số phòng', 9], ['subtotal', 'Tạm tính', 14, 'money'], ['coupon', 'Mã giảm giá', 14],
  ['discount', 'Giảm giá', 12, 'money'], ['total', 'Thành tiền', 14, 'money'], ['status', 'Trạng thái', 16], ['method', 'Thanh toán', 11], ['paidAt', 'Ngày thanh toán', 20]
];
const TRANSFER_COLUMNS = [
  ['code', 'Mã đơn', 12], ['createdAt', 'Ngày đặt', 20], ['customer', 'Khách hàng', 28], ['email', 'Email', 28], ['phone', 'SĐT liên hệ', 14],
  ['company', 'Nhà xe', 28], ['route', 'Tuyến', 40], ['province', 'Tỉnh/TP', 16], ['pickup', 'Giờ đón', 20],
  ['passengers', 'Số khách', 9], ['vehicles', 'Số xe', 7], ['subtotal', 'Tạm tính', 14, 'money'], ['coupon', 'Mã giảm giá', 14],
  ['discount', 'Giảm giá', 12, 'money'], ['total', 'Thành tiền', 14, 'money'], ['status', 'Trạng thái', 16], ['method', 'Thanh toán', 11], ['paidAt', 'Ngày thanh toán', 20]
];
const MONTHLY_COLUMNS = [
  ['month', 'Tháng', 10], ['hotelOrders', 'Đơn phòng đã thanh toán', 14], ['hotelRevenue', 'Doanh thu phòng', 18, 'money'],
  ['transferOrders', 'Đơn xe đã thanh toán', 14], ['transferRevenue', 'Doanh thu xe', 16, 'money'], ['total', 'Tổng doanh thu', 18, 'money']
];

function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map(([key, header, width, kind]) => ({ key, header, width, style: kind === 'money' ? { numFmt: '#,##0" ₫"' } : {} }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B31' } };
  rows.forEach((r) => sheet.addRow(r));
  if (rows.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return sheet;
}

const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Chặn "CSV injection": ô bắt đầu bằng = + - @ bị Excel hiểu là công thức
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const toCsv = (columns, rows) =>
  '﻿' + [columns.map((c) => csvEscape(c[1])).join(','), ...rows.map((r) => columns.map((c) => csvEscape(r[c[0]])).join(','))].join('\r\n');

// [GET] /api/admin/reports/export?format=xlsx|csv&type=hotel|transfer|monthly&from=YYYY-MM-DD&to=YYYY-MM-DD
exports.exportReport = async (req, res) => {
  let range;
  try {
    range = readRange(req.query);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
  try {
    const data = await loadReport(range);
    const stamp = `${new Date(range.from.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)}_${new Date(range.to.getTime() + VN_OFFSET_MS - 1).toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      const type = ['hotel', 'transfer', 'monthly'].includes(req.query.type) ? req.query.type : 'hotel';
      const [columns, rows, name] = {
        hotel: [HOTEL_COLUMNS, data.hotelRows, 'don-dat-phong'],
        transfer: [TRANSFER_COLUMNS, data.transferRows, 'don-dat-xe'],
        monthly: [MONTHLY_COLUMNS, data.monthlyRows, 'doanh-thu-theo-thang']
      }[type];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="nestly-${name}-${stamp}.csv"`);
      return res.status(200).send(toCsv(columns, rows));
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nestly';
    workbook.created = new Date();
    addSheet(workbook, 'Doanh thu theo tháng', MONTHLY_COLUMNS, data.monthlyRows);
    addSheet(workbook, 'Đơn đặt phòng', HOTEL_COLUMNS, data.hotelRows);
    addSheet(workbook, 'Đơn đặt xe', TRANSFER_COLUMNS, data.transferRows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="nestly-bao-cao-${stamp}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Lỗi xuất báo cáo:', error);
    if (!res.headersSent) return res.status(500).json({ success: false, message: 'Không thể xuất báo cáo' });
    return res.end();
  }
};

exports._csv = { toCsv, csvEscape };
