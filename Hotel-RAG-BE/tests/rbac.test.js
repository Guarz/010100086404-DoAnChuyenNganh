// File: tests/rbac.test.js
// Góp ý #6 — RBAC/Ownership: chứng minh phân quyền nằm ở SERVER (negative tests 401/403),
// không dựa vào việc ẩn menu ở frontend.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, createUser, createHotelWithRoom, ymd } = require('./helpers');
const Booking = require('../models/Booking');

let api, stop, admin, partnerA, partnerB, customer, locked, hotelA, roomA, bookingA;

before(async () => {
  ({ api, stop } = await startTestServer());
  admin = await createUser('Admin');
  partnerA = await createUser('Partner');
  partnerB = await createUser('Partner');
  customer = await createUser('Customer');
  locked = await createUser('Customer', { status: 'Locked' });
  ({ hotel: hotelA, roomType: roomA } = await createHotelWithRoom(partnerA.user));
  bookingA = await Booking.create({
    customerId: customer.user._id, hotelId: hotelA._id, checkInDate: new Date(), checkOutDate: new Date(Date.now() + 86400000),
    totalAmount: 1, bookingStatus: 'Confirmed',
    bookingDetails: [{ roomTypeId: roomA._id, quantity: 1, unitPrice: 1, totalNights: 1 }]
  });
});
after(() => stop());

describe('401 - chưa đăng nhập / token không hợp lệ / tài khoản bị khóa', () => {
  test('không có token', async () => {
    assert.equal((await api('GET', '/admin/users')).status, 401);
    assert.equal((await api('POST', '/bookings', { body: {} })).status, 401);
  });
  test('token giả mạo', async () => {
    assert.equal((await api('GET', '/admin/users', { token: 'abc.def.ghi' })).status, 401);
  });
  test('tài khoản bị khóa không dùng được token cũ', async () => {
    assert.equal((await api('GET', '/bookings/my-bookings', { token: locked.token })).status, 401);
  });
});

describe('403 - Customer gọi API của Admin / Partner', () => {
  const adminCalls = [
    ['GET', '/admin/users'], ['GET', '/admin/hotels'], ['GET', '/admin/rag-analytics'],
    ['PUT', '/admin/hotels/000000000000000000000001/status'], ['PUT', '/admin/users/000000000000000000000001/status']
  ];
  for (const [method, url] of adminCalls) {
    test(`Customer ${method} ${url}`, async () => {
      const body = method === 'GET' ? undefined : { status: 'Approved' };
      assert.equal((await api(method, url, { token: customer.token, body })).status, 403);
    });
  }
  test('Partner cũng không gọi được API Admin', async () => {
    assert.equal((await api('PUT', `/admin/hotels/${hotelA._id}/status`, { token: partnerA.token, body: { status: 'Approved' } })).status, 403);
  });
  test('Customer không tạo khách sạn / khóa phòng / sửa quỹ phòng', async () => {
    assert.equal((await api('POST', '/partner/hotels', { token: customer.token, body: { hotelName: 'x' } })).status, 403);
    assert.equal((await api('PUT', `/partner/rooms/${roomA._id}/toggle`, { token: customer.token })).status, 403);
    assert.equal((await api('PUT', '/partner/inventory', { token: customer.token, body: { roomTypeId: roomA._id } })).status, 403);
    assert.equal((await api('GET', `/partner/inventory/check/${roomA._id}?startDate=${ymd(0)}&endDate=${ymd(1)}`, { token: customer.token })).status, 403);
    assert.equal((await api('GET', '/partner/bookings', { token: customer.token })).status, 403);
  });
});

describe('403 - Partner B thao tác trên khách sạn của Partner A (ownership)', () => {
  test('thêm hạng phòng vào KS của A', async () => {
    const res = await api('POST', `/partner/hotels/${hotelA._id}/rooms`, {
      token: partnerB.token, body: { title: 'Hack', basePrice: 1, totalQuantity: 1 }
    });
    assert.equal(res.status, 403);
  });
  test('khóa / mở hạng phòng của A', async () => {
    assert.equal((await api('PUT', `/partner/rooms/${roomA._id}/toggle`, { token: partnerB.token })).status, 403);
  });
  test('sửa giá / quỹ phòng của A', async () => {
    const res = await api('PUT', '/partner/inventory', {
      token: partnerB.token, body: { roomTypeId: roomA._id, startDate: ymd(0), endDate: ymd(1), newPrice: 1 }
    });
    assert.equal(res.status, 403);
  });
  test('xem quỹ phòng của A', async () => {
    assert.equal((await api('GET', `/partner/inventory/check/${roomA._id}?startDate=${ymd(0)}&endDate=${ymd(1)}`, { token: partnerB.token })).status, 403);
  });
  test('xem đơn của KS A / xác nhận trả phòng đơn của A', async () => {
    assert.equal((await api('GET', `/partner/bookings?hotelId=${hotelA._id}`, { token: partnerB.token })).status, 403);
    assert.equal((await api('PUT', `/partner/bookings/${bookingA._id}/complete`, { token: partnerB.token })).status, 403);
  });
  test('danh sách đơn của B không chứa đơn của A', async () => {
    const res = await api('GET', '/partner/bookings', { token: partnerB.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0);
  });
});

describe('Ownership của Customer', () => {
  test('khách khác không xem / hủy / thanh toán đơn của người khác', async () => {
    const other = await createUser('Customer');
    const pending = await Booking.create({
      customerId: customer.user._id, hotelId: hotelA._id, checkInDate: new Date(), checkOutDate: new Date(Date.now() + 86400000),
      totalAmount: 1, bookingStatus: 'Pending', expiresAt: new Date(Date.now() + 300000),
      bookingDetails: [{ roomTypeId: roomA._id, quantity: 1, unitPrice: 1, totalNights: 1 }]
    });
    assert.equal((await api('GET', `/bookings/${pending._id}`, { token: other.token })).status, 404);
    assert.equal((await api('PUT', `/bookings/${pending._id}/cancel`, { token: other.token })).status, 404);
    assert.equal((await api('POST', '/payments/vnpay/create_url', { token: other.token, body: { bookingId: pending._id } })).status, 403);
  });
  test('không review đơn của người khác', async () => {
    const other = await createUser('Customer');
    const res = await api('POST', '/reviews', { token: other.token, body: { bookingId: bookingA._id, rating: 5, comment: 'Tuyệt vời lắm' } });
    assert.equal(res.status, 404);
  });
});

describe('Positive - đúng chủ / Admin thì được phép', () => {
  test('Partner A khóa được phòng của mình, Admin cũng được', async () => {
    assert.equal((await api('PUT', `/partner/rooms/${roomA._id}/toggle`, { token: partnerA.token })).status, 200);
    assert.equal((await api('PUT', `/partner/rooms/${roomA._id}/toggle`, { token: admin.token })).status, 200);
  });
  test('Partner A sửa được quỹ phòng của mình; dữ liệu sai bị từ chối 400', async () => {
    const ok = await api('PUT', '/partner/inventory', {
      token: partnerA.token, body: { roomTypeId: roomA._id, startDate: ymd(0), endDate: ymd(1), newPrice: 900000 }
    });
    assert.equal(ok.status, 200);
    const bad = await api('PUT', '/partner/inventory', {
      token: partnerA.token, body: { roomTypeId: roomA._id, startDate: ymd(0), endDate: ymd(1), newQuantity: 999 }
    });
    assert.equal(bad.status, 400);
  });
});
