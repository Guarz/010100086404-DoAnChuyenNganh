// File: tests/embedding.test.js
// Kiểm tra vòng đời Vector AI (embedding) của khách sạn trong luồng Partner -> Admin:
// tạo KS (chưa có vector) -> Admin duyệt (tạo vector) -> thêm hạng phòng (không cần vector mới,
// AI tìm thấy ngay) -> sửa nội dung (tạo lại vector) -> sửa ảnh (không tạo lại).
// Gemini được thay bằng hàm giả để test không gọi mạng và đếm được số lần tạo vector.
const path = require('path');

const DIMS = 3072;
const embedCalls = [];
let embedShouldFail = false;
const fakeVector = (seed) => Array.from({ length: DIMS }, (_, i) => Math.sin(seed + i));
const aiServicePath = require.resolve(path.join(__dirname, '../services/aiService'));
require.cache[aiServicePath] = {
  id: aiServicePath, filename: aiServicePath, loaded: true,
  exports: {
    generateHotelEmbedding: async (hotel) => {
      embedCalls.push(hotel.hotelName);
      return embedShouldFail ? [] : fakeVector(embedCalls.length);
    }
  }
};

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, createUser } = require('./helpers');
const Hotel = require('../models/Hotel');
const { retrieveRooms } = require('../services/ragRetrieval');
const { parseQueryConstraints } = require('../services/queryConstraintParser');

let ctx;
let partner;
let admin;
let hotelId;

const waitFor = async (check, ms = 2000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
};
const embeddingOf = async (id) => (await Hotel.findById(id).select('embedding').lean()).embedding || [];

const newHotelBody = (name) => ({
  hotelName: name,
  description: 'Khách sạn view biển, có hồ bơi vô cực và nhà hàng hải sản.',
  address: { street: '12 Trần Phú', city: 'Nha Trang', province: 'Khánh Hòa' },
  amenities: ['Hồ bơi vô cực', 'Wi-Fi'],
  images: []
});

before(async () => {
  ctx = await startTestServer();
  partner = await createUser('Partner', { partnerApplicationStatus: 'Approved' });
  admin = await createUser('Admin');
});
after(() => ctx.stop());

test('Partner tạo KS: chưa sinh vector (chờ Admin duyệt)', async () => {
  const res = await ctx.api('POST', '/partner/hotels', { token: partner.token, body: newHotelBody('Sóng Biển Nha Trang') });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  hotelId = res.body.data._id;
  assert.equal(res.body.data.status, 'Pending');
  assert.deepEqual(await embeddingOf(hotelId), []);
  assert.equal(embedCalls.length, 0);
});

test('Admin duyệt KS: sinh vector 3072 chiều', async () => {
  const res = await ctx.api('PUT', `/admin/hotels/${hotelId}/status`, { token: admin.token, body: { status: 'Approved' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.match(res.body.message, /tạo Vector AI thành công/);
  assert.equal(res.body.data.embedding, undefined, 'không trả mảng vector về client');
  assert.equal((await embeddingOf(hotelId)).length, DIMS);
  assert.deepEqual(embedCalls, ['Sóng Biển Nha Trang']);
});

test('Partner thêm hạng phòng: không sinh vector mới nhưng AI tìm thấy phòng ngay', async () => {
  const before = embedCalls.length;
  const res = await ctx.api('POST', `/partner/hotels/${hotelId}/rooms`, {
    token: partner.token,
    body: { title: 'Phòng Ocean Suite', description: 'Ban công nhìn thẳng ra biển', basePrice: 1500000, maxAdults: 2, maxChildren: 1, totalQuantity: 3, amenities: ['Bồn tắm'] }
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(embedCalls.length, before, 'vector là của khách sạn, thêm phòng không gọi lại AI');

  // Truy hồi RAG với vector câu hỏi (giả lập vector gần với vector khách sạn)
  const queryVector = await embeddingOf(hotelId);
  const query = 'phòng ocean suite nhìn biển ở Nha Trang';
  const { results } = await retrieveRooms({ query, constraints: parseQueryConstraints(query), queryVector, k: 5 });
  const hit = results.find((r) => r.room.title === 'Phòng Ocean Suite');
  assert.ok(hit, 'phòng mới phải xuất hiện trong kết quả AI');
  assert.equal(results[0].room.title, 'Phòng Ocean Suite');
});

test('Partner sửa mô tả KS đã duyệt: tạo lại vector (chạy nền)', async () => {
  const oldVector = await embeddingOf(hotelId);
  const res = await ctx.api('PUT', `/partner/hotels/${hotelId}`, {
    token: partner.token, body: { description: 'Đã nâng cấp: thêm spa và phòng gym nhìn ra vịnh Nha Trang.' }
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.match(res.body.message, /cập nhật dữ liệu tìm kiếm AI/);
  const changed = await waitFor(async () => (await embeddingOf(hotelId))[0] !== oldVector[0]);
  assert.ok(changed, 'vector phải được thay bằng vector mới');
  assert.equal(embedCalls.length, 2);
});

test('Partner chỉ đổi ảnh: không tạo lại vector', async () => {
  const res = await ctx.api('PUT', `/partner/hotels/${hotelId}`, {
    token: partner.token, body: { images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200'] }
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(embedCalls.length, 2);
});

test('AI lỗi khi duyệt: vẫn duyệt, báo Admin là chưa có vector', async () => {
  const created = await ctx.api('POST', '/partner/hotels', { token: partner.token, body: newHotelBody('Gió Lộng Resort') });
  embedShouldFail = true;
  const res = await ctx.api('PUT', `/admin/hotels/${created.body.data._id}/status`, { token: admin.token, body: { status: 'Approved' } });
  embedShouldFail = false;
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'Approved');
  assert.match(res.body.message, /chưa tạo được Vector AI/);
  assert.deepEqual(await embeddingOf(created.body.data._id), []);
});
