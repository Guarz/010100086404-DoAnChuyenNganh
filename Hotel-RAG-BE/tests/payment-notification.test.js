// File: tests/payment-notification.test.js
// Kết quả thanh toán VNPay: xác nhận đơn + thông báo, không tạo trùng khi tải lại trang kết quả,
// kiểm tra số tiền khi đổi mã giảm giá; thông báo trong trang (đơn mới, khách hủy, hồ sơ được duyệt).
const crypto = require('node:crypto');
const qs = require('qs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { startTestServer, createUser, createHotelWithRoom, ymd } = require('./helpers');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const Coupon = require('../models/Coupon');

let api, stop, admin, partner, customer, hotel, room;
const book = () => api('POST', '/bookings', {
  token: customer.token,
  body: { hotelId: hotel._id, checkInDate: ymd(1), checkOutDate: ymd(2), bookingDetails: [{ roomTypeId: room._id, quantity: 1 }] }
});

// Query VNPay gửi về trình duyệt, ký HMAC-SHA512 giống VNPay
const vnpayResult = (bookingId, amount, responseCode = '00', transactionNo = String(Date.now())) => {
  const params = { vnp_TxnRef: String(bookingId), vnp_ResponseCode: responseCode, vnp_Amount: String(amount * 100), vnp_TransactionNo: transactionNo };
  const sorted = {};
  Object.keys(params).map(encodeURIComponent).sort().forEach((k) => { sorted[k] = encodeURIComponent(params[k]).replace(/%20/g, '+'); });
  const hash = crypto.createHmac('sha512', process.env.VNP_HASH_SECRET).update(Buffer.from(qs.stringify(sorted, { encode: false }), 'utf-8')).digest('hex');
  return '?' + qs.stringify({ ...sorted, vnp_SecureHash: hash }, { encode: false });
};

before(async () => {
  ({ api, stop } = await startTestServer());
  admin = await createUser('Admin');
  partner = await createUser('Partner');
  customer = await createUser('Customer');
  ({ hotel, roomType: room } = await createHotelWithRoom(partner.user, { basePrice: 800000 }));
});
after(() => stop());

test('Không còn endpoint MoMo', async () => {
  const id = (await book()).body.data._id;
  assert.equal((await api('POST', '/payments/momo/create_url', { token: customer.token, body: { bookingId: id } })).status, 404);
});

test('VNPay thành công -> đơn Confirmed, 1 Payment; tải lại trang kết quả không tạo trùng; báo chủ KS + khách', async () => {
  const id = (await book()).body.data._id;
  const query = vnpayResult(id, 800000, '00', '14000001');
  const res = await api('GET', `/payments/vnpay/return${query}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.type, 'hotel');
  assert.equal((await Booking.findById(id)).bookingStatus, 'Confirmed');

  assert.equal((await api('GET', `/payments/vnpay/return${query}`)).status, 200);
  const payments = await Payment.find({ bookingId: id, paymentStatus: 'Success' });
  assert.equal(payments.length, 1);
  assert.equal(payments[0].paymentMethod, 'VNPay');
  assert.equal(payments[0].transactionId, '14000001');

  const partnerNotes = await Notification.find({ userId: partner.user._id, type: 'order_new' });
  assert.equal(partnerNotes.length, 1);
  assert.match(partnerNotes[0].title, /Đơn đặt phòng mới/);
  assert.equal(await Notification.countDocuments({ userId: customer.user._id, type: 'order_paid' }), 1);
});

test('Chữ ký sai / VNPay báo thất bại -> không xác nhận đơn', async () => {
  const id = (await book()).body.data._id;
  const forged = vnpayResult(id, 800000).replace('vnp_Amount=80000000', 'vnp_Amount=100000'); // sửa số tiền sau khi ký
  assert.equal((await api('GET', `/payments/vnpay/return${forged}`)).status, 400);
  assert.equal((await api('GET', `/payments/vnpay/return${vnpayResult(id, 800000, '24')}`)).status, 400);
  assert.equal((await Booking.findById(id)).bookingStatus, 'Pending');
});

test('Đổi mã giảm giá sau khi tạo link: số tiền trả không khớp -> không xác nhận', async () => {
  await Coupon.create({ code: 'GIAM50K', discountType: 'amount', value: 50000, appliesTo: 'all', createdBy: admin.user._id, ownerRole: 'Admin' });
  const id = (await book()).body.data._id;
  await api('PUT', `/bookings/${id}/coupon`, { token: customer.token, body: { code: 'GIAM50K' } });
  // Link tạo lúc còn mã (750.000), sau đó khách bỏ mã (tổng thành 800.000) rồi mới trả 750.000
  await api('DELETE', `/bookings/${id}/coupon`, { token: customer.token });
  const res = await api('GET', `/payments/vnpay/return${vnpayResult(id, 750000)}`);
  assert.equal(res.status, 400);
  assert.match(res.body.message, /không khớp/);
  assert.equal((await Booking.findById(id)).bookingStatus, 'Pending');
});

test('Thông báo: khách hủy -> báo chủ KS; Admin duyệt KS -> báo Partner; xem / đánh dấu đã đọc', async () => {
  const id = (await book()).body.data._id;
  assert.equal((await api('PUT', `/bookings/${id}/cancel`, { token: customer.token })).status, 200);
  assert.ok(await Notification.countDocuments({ userId: partner.user._id, type: 'order_canceled' }) >= 1);

  // Partner tạo KS mới -> Admin nhận thông báo; Admin duyệt -> Partner nhận thông báo
  const created = await api('POST', '/partner/hotels', {
    token: partner.token,
    body: { hotelName: 'Khách sạn Thông Báo', description: 'Khách sạn để kiểm tra thông báo trong trang.', address: { street: '1 Lê Lợi', city: 'Huế', province: 'Thừa Thiên Huế' }, amenities: ['Wifi'] }
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(await Notification.countDocuments({ userId: admin.user._id, type: 'application_submitted' }), 1);
  await api('PUT', `/admin/hotels/${created.body.data._id}/status`, { token: admin.token, body: { status: 'Approved' } });
  const approved = await Notification.findOne({ userId: partner.user._id, type: 'application_approved' });
  assert.match(approved.title, /Thông Báo" đã được duyệt/);

  let list = await api('GET', '/notifications', { token: partner.token });
  assert.equal(list.status, 200);
  assert.equal(list.body.unreadCount, list.body.data.length);
  assert.equal(list.body.data[0].type, 'application_approved', 'mới nhất nằm đầu');

  // Người khác không đánh dấu được thông báo của Partner
  assert.equal((await api('PUT', `/notifications/${approved._id}/read`, { token: customer.token })).body.updated, 0);
  await api('PUT', `/notifications/${approved._id}/read`, { token: partner.token });
  list = await api('GET', '/notifications', { token: partner.token });
  assert.equal(list.body.unreadCount, list.body.data.length - 1);
  await api('PUT', '/notifications/read-all', { token: partner.token });
  assert.equal((await api('GET', '/notifications', { token: partner.token })).body.unreadCount, 0);
  assert.equal((await api('GET', '/notifications')).status, 401);
});
