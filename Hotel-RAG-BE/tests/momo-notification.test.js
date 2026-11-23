// File: tests/momo-notification.test.js
// Thanh toán MoMo (server MoMo giả lập, không gọi mạng), kiểm tra số tiền khi đổi mã giảm giá,
// và thông báo trong trang (đơn mới, khách hủy, hồ sơ được duyệt).
const http = require('node:http');
const crypto = require('node:crypto');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

let momoRequest;
const momo = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    momoRequest = JSON.parse(body);
    res.writeHead(200, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ resultCode: 0, message: 'Thành công.', payUrl: 'https://test-payment.momo.vn/pay/fake' }));
  });
});

const { startTestServer, createUser, createHotelWithRoom, ymd } = require('./helpers');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const Coupon = require('../models/Coupon');
const { _momo } = require('../controllers/paymentController');

let api, base, stop, admin, partner, customer, hotel, room;
const book = () => api('POST', '/bookings', {
  token: customer.token,
  body: { hotelId: hotel._id, checkInDate: ymd(1), checkOutDate: ymd(2), bookingDetails: [{ roomTypeId: room._id, quantity: 1 }] }
});

// Kết quả MoMo gửi về (trình duyệt / IPN) kèm chữ ký đúng
const momoResult = (orderId, amount, resultCode = 0) => {
  const cfg = _momo.momoConfig();
  const p = {
    partnerCode: cfg.partnerCode, orderId, requestId: orderId, amount: String(amount), orderInfo: 'Thanh toan',
    orderType: 'momo_wallet', transId: '4088' + Date.now(), resultCode: String(resultCode), message: resultCode ? 'Từ chối' : 'Thành công.',
    payType: 'qr', responseTime: String(Date.now()), extraData: ''
  };
  const raw = `accessKey=${cfg.accessKey}&amount=${p.amount}&extraData=${p.extraData}&message=${p.message}&orderId=${p.orderId}` +
    `&orderInfo=${p.orderInfo}&orderType=${p.orderType}&partnerCode=${p.partnerCode}&payType=${p.payType}&requestId=${p.requestId}` +
    `&responseTime=${p.responseTime}&resultCode=${p.resultCode}&transId=${p.transId}`;
  return { ...p, signature: _momo.momoSign(raw, cfg.secretKey) };
};
const qs = (o) => '?' + new URLSearchParams(o).toString();

before(async () => {
  momo.listen(0);
  await new Promise((r) => momo.once('listening', r));
  process.env.MOMO_ENDPOINT = `http://127.0.0.1:${momo.address().port}/v2/gateway/api/create`;
  process.env.APP_URL = 'https://nestly-web.example';
  ({ api, base, stop } = await startTestServer());
  admin = await createUser('Admin');
  partner = await createUser('Partner');
  customer = await createUser('Customer');
  ({ hotel, roomType: room } = await createHotelWithRoom(partner.user, { basePrice: 800000 }));
});
after(async () => {
  await new Promise((r) => momo.close(r));
  delete process.env.MOMO_ENDPOINT;
  await stop();
});

test('Tạo link MoMo: gửi đúng số tiền, URL quay về, chữ ký HMAC-SHA256', async () => {
  const id = (await book()).body.data._id;
  const res = await api('POST', '/payments/momo/create_url', { token: customer.token, body: { bookingId: id } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.paymentUrl, 'https://test-payment.momo.vn/pay/fake');
  assert.equal(momoRequest.amount, '800000');
  assert.equal(momoRequest.redirectUrl, 'https://nestly-web.example/payment/momo-return');
  assert.match(momoRequest.ipnUrl, /\/api\/payments\/momo\/ipn$/);
  assert.ok(momoRequest.orderId.startsWith(`${id}-`));
  const cfg = _momo.momoConfig();
  const r = momoRequest;
  const raw = `accessKey=${cfg.accessKey}&amount=${r.amount}&extraData=${r.extraData}&ipnUrl=${r.ipnUrl}&orderId=${r.orderId}` +
    `&orderInfo=${r.orderInfo}&partnerCode=${r.partnerCode}&redirectUrl=${r.redirectUrl}&requestId=${r.requestId}&requestType=${r.requestType}`;
  assert.equal(r.signature, crypto.createHmac('sha256', cfg.secretKey).update(raw).digest('hex'));
  // Khách khác không tạo link cho đơn người khác
  const stranger = await createUser('Customer');
  assert.equal((await api('POST', '/payments/momo/create_url', { token: stranger.token, body: { bookingId: id } })).status, 403);
});

test('MoMo trả kết quả thành công -> đơn Confirmed, 1 Payment MoMo; IPN gọi lại không tạo trùng; báo chủ KS + khách', async () => {
  const id = (await book()).body.data._id;
  const result = momoResult(`${id}-${Date.now()}`, 800000);
  const res = await api('GET', `/payments/momo/return${qs(result)}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.type, 'hotel');
  assert.equal((await Booking.findById(id)).bookingStatus, 'Confirmed');

  const ipn = await fetch(`${base}/payments/momo/ipn`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) });
  assert.equal(ipn.status, 204);
  const payments = await Payment.find({ bookingId: id, paymentStatus: 'Success' });
  assert.equal(payments.length, 1);
  assert.equal(payments[0].paymentMethod, 'Momo');
  assert.equal(payments[0].transactionId, result.transId);

  const partnerNotes = await Notification.find({ userId: partner.user._id, type: 'order_new' });
  assert.equal(partnerNotes.length, 1);
  assert.match(partnerNotes[0].title, /Đơn đặt phòng mới/);
  assert.equal(await Notification.countDocuments({ userId: customer.user._id, type: 'order_paid' }), 1);
});

test('Chữ ký sai / MoMo từ chối -> không xác nhận đơn', async () => {
  const id = (await book()).body.data._id;
  const forged = { ...momoResult(`${id}-1`, 800000), amount: '1000' }; // sửa số tiền sau khi ký
  assert.equal((await api('GET', `/payments/momo/return${qs(forged)}`)).status, 400);
  const declined = momoResult(`${id}-2`, 800000, 1006);
  assert.equal((await api('GET', `/payments/momo/return${qs(declined)}`)).status, 400);
  assert.equal((await Booking.findById(id)).bookingStatus, 'Pending');
});

test('Đổi mã giảm giá sau khi tạo link: số tiền trả không khớp -> không xác nhận', async () => {
  await Coupon.create({ code: 'GIAM50K', discountType: 'amount', value: 50000, appliesTo: 'all', createdBy: admin.user._id, ownerRole: 'Admin' });
  const id = (await book()).body.data._id;
  await api('PUT', `/bookings/${id}/coupon`, { token: customer.token, body: { code: 'GIAM50K' } });
  // Link tạo lúc còn mã (750.000), sau đó khách bỏ mã (tổng thành 800.000) rồi mới trả 750.000
  await api('DELETE', `/bookings/${id}/coupon`, { token: customer.token });
  const res = await api('GET', `/payments/momo/return${qs(momoResult(`${id}-3`, 750000))}`);
  assert.equal(res.status, 400);
  assert.match(res.body.message, /không khớp/);
  assert.equal((await Booking.findById(id)).bookingStatus, 'Pending');
});

test('Thông báo: khách hủy -> báo chủ KS; Admin duyệt KS -> báo Partner; xem / đánh dấu đã đọc', async () => {
  const id = (await book()).body.data._id;
  assert.equal((await api('PUT', `/bookings/${id}/cancel`, { token: customer.token })).status, 200);
  assert.equal(await Notification.countDocuments({ userId: partner.user._id, type: 'order_canceled' }), 1);

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

