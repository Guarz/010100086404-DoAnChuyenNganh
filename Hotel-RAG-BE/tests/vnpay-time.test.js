// File: tests/vnpay-time.test.js
// VNPay hiểu vnp_CreateDate / vnp_ExpireDate là giờ Việt Nam (GMT+7). Trước đây backend dùng giờ
// của máy chủ: trên Render (UTC) hạn thanh toán bị lệch 7 tiếng về quá khứ -> VNPay luôn báo
// "Giao dịch đã quá thời gian chờ thanh toán". Test này giả lập máy chủ chạy UTC.
process.env.TZ = 'UTC';
process.env.VNP_TMN_CODE = 'TESTCODE';
process.env.VNP_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
process.env.VNP_RETURN_URL = 'http://localhost:5173/payment/vnpay-return';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, createUser, createHotelWithRoom } = require('./helpers');
const Booking = require('../models/Booking');
const { formatVNPayDate } = require('../controllers/paymentController');

// "yyyyMMddHHmmss" giờ VN -> thời điểm thật
const parseVN = (s) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}+07:00`);

let ctx;
before(async () => { ctx = await startTestServer(); });
after(() => ctx.stop());

test('formatVNPayDate luôn trả giờ Việt Nam, kể cả khi máy chủ chạy UTC', () => {
  assert.equal(new Date().getTimezoneOffset(), 0, 'test phải chạy với TZ=UTC');
  assert.equal(formatVNPayDate(new Date('2026-11-15T03:04:05Z')), '20261115100405');
  // Qua nửa đêm giờ VN thì sang ngày mới dù giờ UTC vẫn là hôm trước
  assert.equal(formatVNPayDate(new Date('2026-11-15T17:30:00Z')), '20261116003000');
  assert.equal(formatVNPayDate(new Date('2026-12-31T23:59:59Z')), '20270101065959');
});

test('Link VNPay: CreateDate = bây giờ, ExpireDate = hết thời gian giữ chỗ (đều theo giờ VN)', async () => {
  const partner = await createUser('Partner');
  const customer = await createUser('Customer');
  const { hotel, roomType } = await createHotelWithRoom(partner.user);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const booking = await Booking.create({
    customerId: customer.user._id, hotelId: hotel._id, checkInDate: new Date(), checkOutDate: new Date(Date.now() + 86400000),
    totalAmount: 1000000, bookingStatus: 'Pending', expiresAt,
    bookingDetails: [{ roomTypeId: roomType._id, quantity: 1, unitPrice: 1000000, totalNights: 1 }]
  });

  const before = Date.now();
  const res = await ctx.api('POST', '/payments/vnpay/create_url', { token: customer.token, body: { bookingId: booking._id } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const params = new URL(res.body.paymentUrl).searchParams;
  const created = parseVN(params.get('vnp_CreateDate'));
  const expire = parseVN(params.get('vnp_ExpireDate'));

  assert.ok(Math.abs(created.getTime() - before) < 5000, `CreateDate phải là bây giờ (lệch ${created.getTime() - before} ms)`);
  assert.ok(Math.abs(expire.getTime() - expiresAt.getTime()) < 1000, 'ExpireDate trùng hạn giữ chỗ');
  assert.ok(expire > created, 'hạn thanh toán phải ở tương lai so với lúc tạo');
});
