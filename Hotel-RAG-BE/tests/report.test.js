// File: tests/report.test.js - thống kê doanh thu / tỷ lệ lấp phòng và xuất báo cáo Excel / CSV
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { startTestServer, createUser, createHotelWithRoom } = require('./helpers');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { lastMonths } = require('../services/statsService');

let api, base, stop, admin, partner, otherPartner, customer, hotel, room, otherHotel, otherRoom;
const DAY = 24 * 60 * 60 * 1000;

before(async () => {
  ({ api, base, stop } = await startTestServer());
  admin = await createUser('Admin');
  partner = await createUser('Partner');
  otherPartner = await createUser('Partner');
  customer = await createUser('Customer');
  // Tên có dạng công thức Excel để kiểm tra chặn "CSV injection"
  await User.updateOne({ _id: customer.user._id }, { fullName: '=HYPERLINK("http://x")' });
  ({ hotel, roomType: room } = await createHotelWithRoom(partner.user, { stock: 5 }));
  ({ hotel: otherHotel, roomType: otherRoom } = await createHotelWithRoom(otherPartner.user, { stock: 3 }));

  // Tháng hiện tại: KS của partner có 1 đơn 2 phòng x 2 đêm (4 đêm-phòng), đã thanh toán 2.000.000
  const month = lastMonths(1)[0];
  const paid = await Booking.create({
    customerId: customer.user._id, hotelId: hotel._id, checkInDate: new Date(month.dayStart), checkOutDate: new Date(month.dayStart + 2 * DAY),
    totalAmount: 1800000, subtotalAmount: 2000000, coupon: { code: 'GIAM200K', discountAmount: 200000 },
    bookingStatus: 'Confirmed', bookingDetails: [{ roomTypeId: room._id, quantity: 2, unitPrice: 500000, totalNights: 2 }]
  });
  await Payment.create({ bookingId: paid._id, paymentMethod: 'VNPay', amount: 1800000, paymentStatus: 'Success', paymentDate: new Date() });
  // KS của partner khác: không được tính vào thống kê của partner
  const other = await Booking.create({
    customerId: customer.user._id, hotelId: otherHotel._id, checkInDate: new Date(month.dayStart), checkOutDate: new Date(month.dayStart + DAY),
    totalAmount: 900000, bookingStatus: 'Confirmed', bookingDetails: [{ roomTypeId: otherRoom._id, quantity: 1, unitPrice: 900000, totalNights: 1 }]
  });
  await Payment.create({ bookingId: other._id, paymentMethod: 'VNPay', amount: 900000, paymentStatus: 'Success', paymentDate: new Date() });
  // Đơn đã hủy: không tính doanh thu / lấp phòng
  await Booking.create({
    customerId: customer.user._id, hotelId: hotel._id, checkInDate: new Date(month.dayStart), checkOutDate: new Date(month.dayStart + 5 * DAY),
    totalAmount: 5000000, bookingStatus: 'Canceled', bookingDetails: [{ roomTypeId: room._id, quantity: 1, unitPrice: 1000000, totalNights: 5 }]
  });
});
after(() => stop());

test('Partner: doanh thu, số đơn, tỷ lệ lấp phòng theo tháng chỉ của khách sạn mình', async () => {
  const res = await api('GET', '/partner/stats?months=6', { token: partner.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { months, totals, byHotel } = res.body.data;
  assert.equal(months.length, 6);
  const current = months[months.length - 1];
  const month = lastMonths(1)[0];
  assert.equal(current.revenue, 1800000);
  assert.equal(current.orders, 1);
  assert.equal(current.soldRoomNights, 4);
  assert.equal(current.capacityRoomNights, 5 * month.days);
  assert.equal(current.occupancyRate, Math.round((4 / (5 * month.days)) * 1000) / 10);
  assert.equal(totals.revenue, 1800000);
  assert.equal(byHotel.length, 1);
  assert.equal(byHotel[0].hotelName, hotel.hotelName);
  // Khách hàng không xem được
  assert.equal((await api('GET', '/partner/stats', { token: customer.token })).status, 403);
});

test('Admin: thống kê toàn sàn (cả 2 khách sạn)', async () => {
  const res = await api('GET', '/admin/stats?months=3', { token: admin.token });
  assert.equal(res.status, 200);
  const current = res.body.data.months.at(-1);
  assert.equal(current.hotelRevenue, 2700000);
  assert.equal(current.soldRoomNights, 5);
  assert.equal(res.body.data.byHotel.length, 2);
  assert.equal((await api('GET', '/admin/stats', { token: partner.token })).status, 403);
});

test('Xuất Excel: 3 sheet, đủ cột, có mã giảm giá và phương thức thanh toán', async () => {
  const res = await fetch(`${base}/admin/reports/export?format=xlsx`, { headers: { Authorization: `Bearer ${admin.token}` } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /spreadsheetml/);
  assert.match(res.headers.get('content-disposition'), /nestly-bao-cao-.*\.xlsx/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
  assert.deepEqual(wb.worksheets.map((s) => s.name), ['Doanh thu theo tháng', 'Đơn đặt phòng', 'Đơn đặt xe']);
  const sheet = wb.getWorksheet('Đơn đặt phòng');
  assert.equal(sheet.getRow(1).getCell(1).value, 'Mã đơn');
  assert.equal(sheet.rowCount, 1 + 3); // tiêu đề + 3 đơn
  const header = sheet.getRow(1).values;
  const rows = [2, 3, 4].map((i) => sheet.getRow(i).values);
  const withCoupon = rows.find((r) => r[header.indexOf('Mã giảm giá')] === 'GIAM200K');
  assert.ok(withCoupon, 'có dòng đơn dùng mã giảm giá');
  assert.equal(withCoupon[header.indexOf('Thành tiền')], 1800000);
  assert.equal(withCoupon[header.indexOf('Thanh toán')], 'VNPay');
  const monthly = wb.getWorksheet('Doanh thu theo tháng').getRow(2).values;
  assert.equal(monthly.at(-1), 2700000, 'tổng doanh thu tháng');
});

test('Xuất CSV: UTF-8 có BOM (Excel đọc đúng tiếng Việt), chặn CSV injection; chỉ Admin', async () => {
  const res = await fetch(`${base}/admin/reports/export?format=csv&type=hotel`, { headers: { Authorization: `Bearer ${admin.token}` } });
  assert.equal(res.status, 200);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.deepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const text = buf.toString('utf8').slice(1);
  const lines = text.split('\r\n');
  assert.match(lines[0], /^Mã đơn,Ngày đặt,Khách hàng/);
  assert.equal(lines.length, 4);
  assert.ok(text.includes(`"'=HYPERLINK(""http://x"")`), 'ô bắt đầu bằng = được thêm dấu nháy');

  const bad = await fetch(`${base}/admin/reports/export?format=csv&from=2026-12-31&to=2026-01-01`, { headers: { Authorization: `Bearer ${admin.token}` } });
  assert.equal(bad.status, 400);
  const forbidden = await fetch(`${base}/admin/reports/export`, { headers: { Authorization: `Bearer ${partner.token}` } });
  assert.equal(forbidden.status, 403);
});
