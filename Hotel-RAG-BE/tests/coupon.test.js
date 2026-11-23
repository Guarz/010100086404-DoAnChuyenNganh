// File: tests/coupon.test.js - mã giảm giá: Admin / Partner tạo mã, khách áp mã ở trang thanh toán
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, createUser, createHotelWithRoom, ymd } = require('./helpers');
const Coupon = require('../models/Coupon');
const Booking = require('../models/Booking');
const { cancelPendingBooking } = require('../services/inventoryService');

let api, stop, admin, partner, otherPartner, customer, hotel, room, otherHotel;

const book = (token, h = hotel, r = room) => api('POST', '/bookings', {
  token,
  body: { hotelId: h._id, checkInDate: ymd(1), checkOutDate: ymd(3), bookingDetails: [{ roomTypeId: r._id, quantity: 1 }] }
});

before(async () => {
  ({ api, stop } = await startTestServer());
  admin = await createUser('Admin');
  partner = await createUser('Partner');
  otherPartner = await createUser('Partner');
  customer = await createUser('Customer');
  ({ hotel, roomType: room } = await createHotelWithRoom(partner.user, { basePrice: 1000000 }));
  ({ hotel: otherHotel } = await createHotelWithRoom(otherPartner.user));
});
after(() => stop());

test('Admin tạo mã toàn sàn; mã trùng / sai định dạng / giá trị sai bị từ chối; khách không tạo được', async () => {
  let res = await api('POST', '/coupons', { token: admin.token, body: { code: 'giam10', discountType: 'percent', value: 10, maxDiscount: 150000, appliesTo: 'all' } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.code, 'GIAM10');
  assert.equal((await api('POST', '/coupons', { token: admin.token, body: { code: 'GIAM10', discountType: 'percent', value: 5 } })).status, 409);
  assert.equal((await api('POST', '/coupons', { token: admin.token, body: { code: 'có dấu', discountType: 'percent', value: 5 } })).status, 400);
  assert.equal((await api('POST', '/coupons', { token: admin.token, body: { code: 'QUA100', discountType: 'percent', value: 120 } })).status, 400);
  assert.equal((await api('POST', '/coupons', { token: customer.token, body: { code: 'KHACH', discountType: 'percent', value: 5 } })).status, 403);
});

test('Partner chỉ tạo mã cho khách sạn của mình (mã luôn chỉ dùng cho đặt phòng)', async () => {
  let res = await api('POST', '/coupons', { token: partner.token, body: { code: 'KSMINH', discountType: 'amount', value: 100000, appliesTo: 'all', hotelId: hotel._id } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.appliesTo, 'hotel');
  res = await api('POST', '/coupons', { token: partner.token, body: { code: 'KSKHAC', discountType: 'amount', value: 100000, hotelId: otherHotel._id } });
  assert.equal(res.status, 403);
  // Partner chỉ thấy mã của mình, Admin thấy tất cả
  assert.deepEqual((await api('GET', '/coupons', { token: partner.token })).body.data.map((c) => c.code), ['KSMINH']);
  assert.equal((await api('GET', '/coupons', { token: admin.token })).body.data.length, 2);
  // Partner khác không sửa / xóa được mã của người khác
  const id = (await Coupon.findOne({ code: 'KSMINH' }))._id;
  assert.equal((await api('PUT', `/coupons/${id}`, { token: otherPartner.token, body: { isActive: false } })).status, 404);
});

test('Khách áp mã: tổng tiền giảm, giữ 1 lượt; đổi mã trả lượt cũ; bỏ mã trả lượt', async () => {
  const created = await book(customer.token);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data._id;
  const subtotal = created.body.data.totalAmount; // 2 đêm x 1.000.000

  let res = await api('PUT', `/bookings/${id}/coupon`, { token: customer.token, body: { code: 'giam10' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.coupon.discountAmount, 150000, '10% nhưng tối đa 150.000');
  assert.equal(res.body.data.totalAmount, subtotal - 150000);
  assert.equal((await Coupon.findOne({ code: 'GIAM10' })).usedCount, 1);

  // Đổi sang mã của khách sạn: trả lượt GIAM10, giữ lượt KSMINH
  res = await api('PUT', `/bookings/${id}/coupon`, { token: customer.token, body: { code: 'KSMINH' } });
  assert.equal(res.body.data.totalAmount, subtotal - 100000);
  assert.equal((await Coupon.findOne({ code: 'GIAM10' })).usedCount, 0);
  assert.equal((await Coupon.findOne({ code: 'KSMINH' })).usedCount, 1);

  res = await api('DELETE', `/bookings/${id}/coupon`, { token: customer.token });
  assert.equal(res.body.data.totalAmount, subtotal);
  assert.equal((await Coupon.findOne({ code: 'KSMINH' })).usedCount, 0);
  const saved = await Booking.findById(id);
  assert.equal(saved.totalAmount, subtotal);
  assert.equal(saved.coupon?.couponId, undefined);
});

test('Mã KS khác, mã hết hạn, hết lượt, đơn tối thiểu, mỗi khách 1 lần đều bị từ chối', async () => {
  const id = (await book(customer.token)).body.data._id;
  await api('POST', '/coupons', { token: otherPartner.token, body: { code: 'KSKIA', discountType: 'percent', value: 5, hotelId: otherHotel._id } });
  await Coupon.create([
    { code: 'HETHAN', discountType: 'percent', value: 5, appliesTo: 'all', createdBy: admin.user._id, ownerRole: 'Admin', expiresAt: new Date(Date.now() - 1000) },
    { code: 'HETLUOT', discountType: 'percent', value: 5, appliesTo: 'all', createdBy: admin.user._id, ownerRole: 'Admin', usageLimit: 1, usedCount: 1 },
    { code: 'DONLON', discountType: 'percent', value: 5, appliesTo: 'all', createdBy: admin.user._id, ownerRole: 'Admin', minOrderAmount: 50000000 },
    { code: 'CHIXE', discountType: 'percent', value: 5, appliesTo: 'transfer', createdBy: admin.user._id, ownerRole: 'Admin' }
  ]);
  const expectations = { KSKIA: /khách sạn khác/, HETHAN: /hết hạn/, HETLUOT: /hết lượt/, DONLON: /tối thiểu/, CHIXE: /xe đưa đón/, KHONGCO: /không tồn tại/ };
  for (const [code, re] of Object.entries(expectations)) {
    const res = await api('PUT', `/bookings/${id}/coupon`, { token: customer.token, body: { code } });
    assert.equal(res.status, 400, code);
    assert.match(res.body.message, re, code);
  }
  // Mỗi khách dùng GIAM10 một lần: đơn thứ nhất giữ mã thì đơn thứ hai bị từ chối
  assert.equal((await api('PUT', `/bookings/${id}/coupon`, { token: customer.token, body: { code: 'GIAM10' } })).status, 200);
  const id2 = (await book(customer.token)).body.data._id;
  const second = await api('PUT', `/bookings/${id2}/coupon`, { token: customer.token, body: { code: 'GIAM10' } });
  assert.equal(second.status, 400);
  assert.match(second.body.message, /hết lượt của mã/);
  // Khách khác không áp mã vào đơn của người khác
  const stranger = await createUser('Customer');
  assert.equal((await api('PUT', `/bookings/${id}/coupon`, { token: stranger.token, body: { code: 'GIAM10' } })).status, 404);
});

test('Đơn bị hủy / hết hạn giữ chỗ -> trả lượt mã; mã đã có người dùng thì không xóa được', async () => {
  const before = (await Coupon.findOne({ code: 'GIAM10' })).usedCount;
  const pending = await Booking.findOne({ 'coupon.code': 'GIAM10', bookingStatus: 'Pending' });
  assert.ok(pending);
  assert.equal((await api('DELETE', `/coupons/${(await Coupon.findOne({ code: 'GIAM10' }))._id}`, { token: admin.token })).status, 409);
  await cancelPendingBooking({ _id: pending._id }); // cron hủy đơn quá hạn dùng đúng hàm này
  assert.equal((await Coupon.findOne({ code: 'GIAM10' })).usedCount, before - 1);
});

test('Gợi ý mã cho khách: chỉ mã còn hiệu lực, đúng loại đơn / khách sạn', async () => {
  const res = await api('GET', `/coupons/available?kind=hotel&hotelId=${hotel._id}`, { token: customer.token });
  const codes = res.body.data.map((c) => c.code).sort();
  assert.ok(codes.includes('GIAM10') && codes.includes('KSMINH') && codes.includes('DONLON'));
  for (const hidden of ['HETHAN', 'HETLUOT', 'KSKIA', 'CHIXE']) assert.ok(!codes.includes(hidden), hidden);
  const transferCodes = (await api('GET', '/coupons/available?kind=transfer', { token: customer.token })).body.data.map((c) => c.code);
  assert.ok(transferCodes.includes('CHIXE') && transferCodes.includes('GIAM10') && !transferCodes.includes('KSMINH'));
});
