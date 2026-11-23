// File: services/statsService.js
// Thống kê theo tháng (giờ Việt Nam) cho Partner và Admin:
//  - Doanh thu: tổng tiền các giao dịch thanh toán THÀNH CÔNG (Payment.Success), theo tháng thanh toán
//  - Số đơn đã thanh toán theo tháng
//  - Tỷ lệ lấp phòng: số đêm-phòng đã bán / số đêm-phòng có thể bán trong tháng
//      đã bán   = Σ (số phòng × số đêm của đơn Confirmed/Completed rơi vào tháng đó)
//      có thể bán = Σ (tổng số phòng của các hạng phòng đang mở bán × số ngày trong tháng)
const Booking = require('../models/Booking');
const RoomType = require('../models/RoomType');
const Payment = require('../models/Payment');

const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

const monthKeyOf = (date) => {
  const vn = new Date(new Date(date).getTime() + VN_OFFSET_MS);
  return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
};

// Danh sách N tháng gần nhất (kể cả tháng hiện tại), cũ -> mới
function lastMonths(count, now = new Date()) {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const result = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    result.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `T${m + 1}/${y}`,
      // Mốc thời gian của tháng theo giờ VN (để lọc giao dịch)
      start: new Date(Date.UTC(y, m, 1) - VN_OFFSET_MS),
      end: new Date(Date.UTC(y, m + 1, 1) - VN_OFFSET_MS),
      // Mốc ngày (00:00 UTC) để tính đêm lưu trú - ngày nhận/trả phòng lưu dạng ngày
      dayStart: Date.UTC(y, m, 1),
      dayEnd: Date.UTC(y, m + 1, 1),
      days: Math.round((Date.UTC(y, m + 1, 1) - Date.UTC(y, m, 1)) / DAY_MS)
    });
  }
  return result;
}

// Doanh thu + số đơn đã thanh toán theo tháng cho một tập đơn (bookingIds / transferBookingIds)
async function revenueByMonth(paymentFilter, months) {
  const rows = await Payment.aggregate([
    { $match: { ...paymentFilter, paymentStatus: 'Success', paymentDate: { $gte: months[0].start, $lt: months[months.length - 1].end } } },
    { $project: { amount: 1, month: { $dateToString: { format: '%Y-%m', date: '$paymentDate', timezone: 'Asia/Ho_Chi_Minh' } } } },
    { $group: { _id: '$month', revenue: { $sum: '$amount' }, orders: { $sum: 1 } } }
  ]);
  return new Map(rows.map((r) => [r._id, r]));
}

// hotelIds: null = toàn sàn (Admin)
async function hotelStats({ hotelIds = null, months: count = 6 } = {}) {
  const months = lastMonths(Math.min(24, Math.max(1, Number(count) || 6)));
  const hotelFilter = hotelIds ? { hotelId: { $in: hotelIds } } : {};
  const first = months[0];
  const last = months[months.length - 1];

  const [bookings, roomTypes] = await Promise.all([
    Booking.find({
      ...hotelFilter,
      bookingStatus: { $in: ['Confirmed', 'Completed'] },
      checkInDate: { $lt: new Date(last.dayEnd) },
      checkOutDate: { $gt: new Date(first.dayStart) }
    }).select('_id hotelId checkInDate checkOutDate bookingDetails').lean(),
    RoomType.find({ ...hotelFilter, isActive: { $ne: false } }).select('hotelId totalQuantity').lean()
  ]);

  const roomsPerHotel = new Map();
  for (const rt of roomTypes) roomsPerHotel.set(String(rt.hotelId), (roomsPerHotel.get(String(rt.hotelId)) || 0) + (rt.totalQuantity || 0));
  const totalRooms = [...roomsPerHotel.values()].reduce((a, b) => a + b, 0);

  // Doanh thu: Payment của các đơn phòng thuộc phạm vi
  let paymentFilter = { bookingId: { $exists: true, $ne: null } };
  if (hotelIds) {
    const ids = await Booking.find(hotelFilter).distinct('_id');
    paymentFilter = { bookingId: { $in: ids } };
  }
  const revenue = await revenueByMonth(paymentFilter, months);

  const soldNights = new Map(months.map((m) => [m.key, 0]));
  const soldByHotel = new Map();
  for (const b of bookings) {
    const rooms = (b.bookingDetails || []).reduce((s, d) => s + (d.quantity || 0), 0);
    const ci = new Date(b.checkInDate).getTime();
    const co = new Date(b.checkOutDate).getTime();
    for (const m of months) {
      const nights = Math.max(0, Math.round((Math.min(co, m.dayEnd) - Math.max(ci, m.dayStart)) / DAY_MS));
      if (!nights) continue;
      soldNights.set(m.key, soldNights.get(m.key) + rooms * nights);
      const h = String(b.hotelId);
      soldByHotel.set(h, (soldByHotel.get(h) || 0) + rooms * nights);
    }
  }

  const series = months.map((m) => {
    const capacity = totalRooms * m.days;
    const sold = soldNights.get(m.key);
    return {
      month: m.key, label: m.label,
      revenue: revenue.get(m.key)?.revenue || 0,
      orders: revenue.get(m.key)?.orders || 0,
      soldRoomNights: sold,
      capacityRoomNights: capacity,
      occupancyRate: capacity ? Math.round((sold / capacity) * 1000) / 10 : 0 // %, 1 chữ số thập phân
    };
  });

  const periodDays = months.reduce((s, m) => s + m.days, 0);
  const byHotel = [...roomsPerHotel.entries()].map(([hotelId, rooms]) => ({
    hotelId, rooms,
    soldRoomNights: soldByHotel.get(hotelId) || 0,
    occupancyRate: rooms ? Math.round(((soldByHotel.get(hotelId) || 0) / (rooms * periodDays)) * 1000) / 10 : 0
  }));

  return {
    months: series,
    totals: {
      revenue: series.reduce((s, m) => s + m.revenue, 0),
      orders: series.reduce((s, m) => s + m.orders, 0),
      occupancyRate: totalRooms ? Math.round((series.reduce((s, m) => s + m.soldRoomNights, 0) / (totalRooms * periodDays)) * 1000) / 10 : 0,
      rooms: totalRooms
    },
    byHotel
  };
}

// Doanh thu xe đưa đón theo tháng (Admin)
async function transferRevenue({ months: count = 6 } = {}) {
  const months = lastMonths(Math.min(24, Math.max(1, Number(count) || 6)));
  const revenue = await revenueByMonth({ transferBookingId: { $exists: true, $ne: null } }, months);
  return months.map((m) => ({ month: m.key, label: m.label, revenue: revenue.get(m.key)?.revenue || 0, orders: revenue.get(m.key)?.orders || 0 }));
}

module.exports = { hotelStats, transferRevenue, lastMonths, monthKeyOf };
