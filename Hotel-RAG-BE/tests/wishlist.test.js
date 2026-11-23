// File: tests/wishlist.test.js - danh sách khách sạn yêu thích
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, createUser, createHotelWithRoom } = require('./helpers');
const Hotel = require('../models/Hotel');

let ctx, customer, other, hotelA, hotelB;
before(async () => {
  ctx = await startTestServer();
  customer = await createUser('Customer');
  other = await createUser('Customer');
  const partner = await createUser('Partner');
  ({ hotel: hotelA } = await createHotelWithRoom(partner.user));
  ({ hotel: hotelB } = await createHotelWithRoom(partner.user));
});
after(() => ctx.stop());

test('Chưa đăng nhập -> 401', async () => {
  assert.equal((await ctx.api('GET', '/users/me/wishlist')).status, 401);
  assert.equal((await ctx.api('POST', `/users/me/wishlist/${hotelA._id}`)).status, 401);
});

test('Thêm 2 khách sạn (bấm 2 lần không trùng), danh sách mới thêm nằm đầu', async () => {
  for (const id of [hotelA._id, hotelB._id, hotelB._id]) {
    const res = await ctx.api('POST', `/users/me/wishlist/${id}`, { token: customer.token });
    assert.equal(res.status, 200);
  }
  const res = await ctx.api('GET', '/users/me/wishlist', { token: customer.token });
  assert.deepEqual(res.body.ids.map(String), [String(hotelB._id), String(hotelA._id)]);
  assert.equal(res.body.data[0].hotelName, hotelB.hotelName);
  // Danh sách riêng từng người
  const otherRes = await ctx.api('GET', '/users/me/wishlist', { token: other.token });
  assert.deepEqual(otherRes.body.ids, []);
});

test('Bỏ yêu thích; khách sạn không tồn tại / chưa duyệt / mã sai bị từ chối', async () => {
  assert.equal((await ctx.api('DELETE', `/users/me/wishlist/${hotelB._id}`, { token: customer.token })).status, 200);
  const res = await ctx.api('GET', '/users/me/wishlist', { token: customer.token });
  assert.deepEqual(res.body.ids.map(String), [String(hotelA._id)]);

  assert.equal((await ctx.api('POST', '/users/me/wishlist/abc', { token: customer.token })).status, 400);
  assert.equal((await ctx.api('POST', '/users/me/wishlist/651a2b3c4d5e6f7a8b9c9999', { token: customer.token })).status, 404);
  await Hotel.updateOne({ _id: hotelB._id }, { status: 'Pending' });
  assert.equal((await ctx.api('POST', `/users/me/wishlist/${hotelB._id}`, { token: customer.token })).status, 404);
});

test('Khách sạn bị ngừng duyệt thì tự ẩn khỏi danh sách', async () => {
  await Hotel.updateOne({ _id: hotelA._id }, { status: 'Rejected' });
  const res = await ctx.api('GET', '/users/me/wishlist', { token: customer.token });
  assert.deepEqual(res.body.ids, []);
});
