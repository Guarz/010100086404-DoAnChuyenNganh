// File: tests/booking-concurrency.test.js
// Góp ý #5 — Booking concurrency: chống oversell khi nhiều request đồng thời, rollback khi đặt nhiều đêm,
// idempotency khi khách bấm 2 lần / mạng gửi lại. Mỗi test in trạng thái DB trước/sau làm minh chứng.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, createUser, createHotelWithRoom, stockOn, ymd } = require('./helpers');
const Booking = require('../models/Booking');
const RoomInventory = require('../models/RoomInventory');
const { releaseExpiredBookings } = require('../jobs/bookingCron');

let api, stop, partner;

before(async () => {
  ({ api, stop } = await startTestServer());
  ({ user: partner } = await createUser('Partner'));
});
after(() => stop());

const book = (token, hotel, room, { from = 1, to = 2, quantity = 1, key } = {}) => api('POST', '/bookings', {
  token,
  headers: key ? { 'Idempotency-Key': key } : {},
  body: { hotelId: hotel._id, checkInDate: ymd(from), checkOutDate: ymd(to), bookingDetails: [{ roomTypeId: room._id, quantity }] }
});

describe('Chống oversell', () => {
  test('stock = 1, 2 khách đặt ĐỒNG THỜI -> đúng 1 đơn thành công, quỹ = 0', async () => {
    const { hotel, roomType } = await createHotelWithRoom(partner, { stock: 1 });
    const [a, b] = await Promise.all([createUser('Customer'), createUser('Customer')]);
    const before = await stockOn(roomType._id, 1);

    const results = await Promise.all([book(a.token, hotel, roomType), book(b.token, hotel, roomType)]);
    const statuses = results.map((r) => r.status).sort();
    const after = await stockOn(roomType._id, 1);
    console.log(`  [minh chứng] stock trước=${before}, kết quả=${statuses}, stock sau=${after}`);

    assert.deepEqual(statuses, [201, 400]);
    assert.equal(after, 0);
    assert.equal(await Booking.countDocuments({ hotelId: hotel._id }), 1);
  });

  test('stock = 3, 10 request đồng thời -> đúng 3 đơn, quỹ không âm', async () => {
    const { hotel, roomType } = await createHotelWithRoom(partner, { stock: 3 });
    const customers = await Promise.all(Array.from({ length: 10 }, () => createUser('Customer')));
    const results = await Promise.all(customers.map((c) => book(c.token, hotel, roomType)));
    const created = results.filter((r) => r.status === 201).length;
    const after = await stockOn(roomType._id, 1);
    console.log(`  [minh chứng] 10 request -> ${created} thành công, stock sau=${after}`);

    assert.equal(created, 3);
    assert.equal(after, 0);
  });
});

describe('Rollback đặt nhiều đêm', () => {
  test('đêm 1 còn phòng, đêm 2 hết -> từ chối và KHÔNG trừ đêm 1', async () => {
    const { hotel, roomType } = await createHotelWithRoom(partner, { stock: 2 });
    const now = new Date();
    const night2 = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + 2 * 86400000);
    await RoomInventory.updateOne({ roomTypeId: roomType._id, date: night2 }, { $set: { availableRooms: 0 } });
    const { token } = await createUser('Customer');

    const before = [await stockOn(roomType._id, 1), await stockOn(roomType._id, 2), await stockOn(roomType._id, 3)];
    const res = await book(token, hotel, roomType, { from: 1, to: 4 });
    const after = [await stockOn(roomType._id, 1), await stockOn(roomType._id, 2), await stockOn(roomType._id, 3)];
    console.log(`  [minh chứng] quỹ 3 đêm trước=${before}, status=${res.status}, sau=${after}`);

    assert.equal(res.status, 400);
    assert.deepEqual(after, before);
    assert.equal(await Booking.countDocuments({ hotelId: hotel._id }), 0);
  });

  test('hủy đơn Pending / cronjob hủy đơn hết hạn -> hoàn quỹ đúng 1 lần', async () => {
    const { hotel, roomType } = await createHotelWithRoom(partner, { stock: 2 });
    const { token } = await createUser('Customer');

    const b1 = (await book(token, hotel, roomType)).body.data._id;
    assert.equal(await stockOn(roomType._id, 1), 1);
    assert.equal((await api('PUT', `/bookings/${b1}/cancel`, { token })).status, 200);
    assert.equal((await api('PUT', `/bookings/${b1}/cancel`, { token })).status, 400);
    assert.equal(await stockOn(roomType._id, 1), 2);

    const b2 = (await book(token, hotel, roomType)).body.data._id;
    await Booking.updateOne({ _id: b2 }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await Promise.all([releaseExpiredBookings(), releaseExpiredBookings()]);
    assert.equal((await Booking.findById(b2)).bookingStatus, 'Canceled');
    assert.equal(await stockOn(roomType._id, 1), 2);
  });
});

describe('Idempotency', () => {
  test('cùng Idempotency-Key gửi 2 lần ĐỒNG THỜI -> 1 đơn, trừ quỹ 1 lần', async () => {
    const { hotel, roomType } = await createHotelWithRoom(partner, { stock: 5 });
    const { token } = await createUser('Customer');
    const key = 'double-click-0001';

    const [r1, r2] = await Promise.all([
      book(token, hotel, roomType, { key }), book(token, hotel, roomType, { key })
    ]);
    console.log(`  [minh chứng] status=${[r1.status, r2.status]}, stock sau=${await stockOn(roomType._id, 1)}`);

    assert.ok(r1.body.data && r2.body.data);
    assert.equal(r1.body.data._id, r2.body.data._id);
    assert.equal(await Booking.countDocuments({ hotelId: hotel._id }), 1);
    assert.equal(await stockOn(roomType._id, 1), 4);
  });

  test('gửi lại tuần tự trả về đơn cũ (200); dùng lại key cho yêu cầu khác -> 409', async () => {
    const { hotel, roomType } = await createHotelWithRoom(partner, { stock: 5 });
    const { token } = await createUser('Customer');
    const key = 'retry-key-0002';

    const first = await book(token, hotel, roomType, { key });
    const retry = await book(token, hotel, roomType, { key });
    assert.equal(first.status, 201);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.replayed, true);

    const conflict = await book(token, hotel, roomType, { key, from: 3, to: 4 });
    assert.equal(conflict.status, 409);
    assert.equal(await stockOn(roomType._id, 1), 4);
  });
});
