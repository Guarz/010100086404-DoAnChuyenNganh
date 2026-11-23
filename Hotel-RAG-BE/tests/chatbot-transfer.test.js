// File: tests/chatbot-transfer.test.js
// Chatbot hiểu câu hỏi về XE ĐƯA ĐÓN và câu hỏi theo TỈNH:
//  - parser nhận tỉnh / địa danh / tên sân bay, ý định đặt xe, chiều đón (từ / ra sân bay)
//  - /api/ai/search trả tuyến xe còn đặt được (trích dẫn [X1]...), lọc khách sạn theo tỉnh
// Chạy không cần Ollama (OLLAMA_URL trỏ tới cổng trống) -> câu trả lời dựng từ dữ liệu.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, createUser, createHotelWithRoom } = require('./helpers');
const { parseQueryConstraints } = require('../services/queryConstraintParser');
const RagLog = require('../models/RagLog');

const NOW = new Date('2026-10-31T10:00:00+07:00');
const DAY_MS = 24 * 60 * 60 * 1000;
// Ngày (giờ VN) cách hôm nay n ngày -> 'YYYY-MM-DD' và 'dd/mm/yyyy'
const vnDay = (n) => new Date(Date.now() + n * DAY_MS + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
const toDMY = (iso) => iso.split('-').reverse().join('/');

describe('Parser: tỉnh và ý định đặt xe', () => {
  test('nhận tỉnh từ tên tỉnh, địa danh, tên sân bay; thành phố suy ra tỉnh', () => {
    assert.equal(parseQueryConstraints('Khách sạn ở Lâm Đồng dưới 1 triệu', NOW).province, 'Lâm Đồng');
    assert.equal(parseQueryConstraints('resort ở Vũng Tàu có hồ bơi', NOW).province, 'Bà Rịa - Vũng Tàu');
    assert.equal(parseQueryConstraints('homestay Sa Pa', NOW).province, 'Lào Cai');
    assert.equal(parseQueryConstraints('thuê xe ra sân bay Nội Bài', NOW).province, 'Hà Nội');
    const c = parseQueryConstraints('phòng ở Đà Lạt', NOW);
    assert.equal(c.city, 'Đà Lạt');
    assert.equal(c.province, 'Lâm Đồng');
    assert.equal(parseQueryConstraints('phòng view vịnh Hạ Long', NOW).province, 'Quảng Ninh');
  });

  test('câu hỏi đặt xe: không tìm khách sạn, nhận chiều đón, số khách, ngày', () => {
    const c = parseQueryConstraints('Xe đón tôi ở sân bay Đà Nẵng ngày 20/12 cho 5 người', NOW);
    assert.equal(c.isTransferQuery, true);
    assert.equal(c.isHotelQuery, false);
    assert.equal(c.transferDirection, 'fromAirport');
    assert.equal(c.province, 'Đà Nẵng');
    assert.equal(c.adults, 5);
    assert.equal(c.checkIn, '2026-12-20');
    assert.deepEqual(c.amenities, []); // "đưa đón" không thành tiện nghi bắt buộc của khách sạn
    assert.equal(parseQueryConstraints('thuê xe 7 chỗ ra sân bay Nội Bài', NOW).transferDirection, 'toAirport');
    assert.equal(parseQueryConstraints('Xe đưa đón sân bay Đà Nẵng', NOW).transferDirection, null);
  });

  test('"khách sạn có đưa đón sân bay" vẫn là tiện ích khách sạn; câu kết hợp tìm cả hai', () => {
    const amenity = parseQueryConstraints('khách sạn có đưa đón sân bay ở Đà Nẵng', NOW);
    assert.equal(amenity.isTransferQuery, false);
    assert.equal(amenity.isHotelQuery, true);
    assert.deepEqual(amenity.amenities, ['Đưa đón sân bay']);
    const both = parseQueryConstraints('Đặt phòng ở Đà Lạt và thuê xe từ sân bay Liên Khương', NOW);
    assert.equal(both.isTransferQuery, true);
    assert.equal(both.isHotelQuery, true);
  });

  test('câu ngoài phạm vi vẫn bị chặn dù nhắc tới xe', () => {
    const c = parseQueryConstraints('viết code python đặt xe taxi', NOW);
    assert.equal(c.isTransferQuery, false);
    assert.equal(c.isHotelQuery, false);
  });
});

describe('/api/ai/search với xe đưa đón và tỉnh', () => {
  let api, stop, daLatHotel, routeFromAirport, routeToAirport;

  before(async () => {
    ({ api, stop } = await startTestServer());
    const admin = await createUser('Admin');
    const owner = await createUser('Customer');
    const applied = await api('POST', '/transport/apply', {
      token: owner.token,
      body: { companyName: 'Xe Biển Xanh', phone: '0905123456', licenseNumber: 'GP-CB', serviceProvinces: ['Đà Nẵng', 'Lâm Đồng'] }
    });
    assert.equal(applied.status, 201);
    await api('PUT', `/admin/transport-companies/${applied.body.data._id}/status`, { token: admin.token, body: { status: 'Approved' } });
    const vehicle = (await api('POST', '/transport/vehicles', {
      token: owner.token, body: { name: 'Sedan 4 chỗ', seats: 4, luggage: 3, totalVehicles: 2, amenities: ['Điều hòa'] }
    })).body.data;
    const addRoute = async (body) => (await api('POST', `/transport/vehicles/${vehicle._id}/routes`, { token: owner.token, body })).body.data;
    routeFromAirport = await addRoute({ province: 'Đà Nẵng', fromPlace: 'Sân bay Đà Nẵng', toPlace: 'Khu Mỹ Khê', price: 250000, durationMin: 20 });
    routeToAirport = await addRoute({ province: 'Đà Nẵng', fromPlace: 'Khu Mỹ Khê', toPlace: 'Sân bay Đà Nẵng', price: 230000, durationMin: 20 });
    await addRoute({ province: 'Lâm Đồng', fromPlace: 'Sân bay Liên Khương', toPlace: 'Trung tâm Đà Lạt', price: 400000, durationMin: 40 });

    const { user: partner } = await createUser('Partner');
    daLatHotel = await createHotelWithRoom(partner, { city: 'Đà Lạt', room: { title: 'Phòng Đồi Thông' } });
    await createHotelWithRoom(partner, { city: 'Đà Nẵng', room: { title: 'Phòng Biển' } });
  });
  after(() => stop());

  test('hỏi xe đón từ sân bay: chỉ trả xe đúng tỉnh, đúng chiều xếp trước, không trả phòng', async () => {
    const res = await api('POST', '/ai/search', { body: { query: 'Xe đón tôi từ sân bay Đà Nẵng cho 2 người' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.rooms.length, 0);
    assert.equal(res.body.transfers.length, 2);
    assert.equal(res.body.transfers[0].routeId, routeFromAirport._id); // đúng chiều trước dù đắt hơn
    assert.equal(res.body.transfers[0].citation, 'X1');
    assert.ok(res.body.transfers.every((t) => t.province === 'Đà Nẵng'));
    assert.match(res.body.answer, /\[X1\]/);
    assert.equal(res.body.answerSource, 'template');
  });

  test('ra sân bay -> tuyến về sân bay đứng đầu', async () => {
    const res = await api('POST', '/ai/search', { body: { query: 'Đặt xe ra sân bay Đà Nẵng' } });
    assert.equal(res.body.transfers[0].routeId, routeToAirport._id);
  });

  test('có ngày + nhiều khách -> kiểm tra quỹ xe, đặt đủ số xe; hết xe thì loại', async () => {
    const date = vnDay(3);
    const ok = await api('POST', '/ai/search', { body: { query: `Xe đưa đón Đà Nẵng ngày ${toDMY(date)} cho 6 người` } });
    assert.equal(ok.body.transfers.length, 2);
    assert.equal(ok.body.transfers[0].vehiclesNeeded, 2);
    assert.equal(ok.body.transfers[0].availableVehicles, 2);
    assert.equal(ok.body.transfers[0].totalPrice, 460000);
    const full = await api('POST', '/ai/search', { body: { query: `Xe đưa đón Đà Nẵng ngày ${toDMY(date)} cho 10 người` } });
    assert.equal(full.body.transfers.length, 0); // cần 3 xe, chỉ còn 2
    assert.match(full.body.answer, /chưa có xe đưa đón còn chỗ/);
  });

  test('ngân sách áp cho giá xe khi chỉ hỏi xe', async () => {
    const res = await api('POST', '/ai/search', { body: { query: 'xe đưa đón Đà Nẵng dưới 240k' } });
    assert.deepEqual(res.body.transfers.map((t) => t.routeId), [routeToAirport._id]);
  });

  test('chưa nêu tỉnh -> hỏi lại tỉnh, không trả xe bừa', async () => {
    const res = await api('POST', '/ai/search', { body: { query: 'thuê xe đưa đón' } });
    assert.equal(res.body.transfers.length, 0);
    assert.match(res.body.answer, /tỉnh\/thành nào/);
  });

  test('câu kết hợp: phòng ở Đà Lạt + xe ở Lâm Đồng', async () => {
    const res = await api('POST', '/ai/search', { body: { query: 'Đặt phòng ở Đà Lạt và thuê xe từ sân bay Liên Khương' } });
    assert.deepEqual(res.body.rooms.map((r) => r.title), ['Phòng Đồi Thông']);
    assert.equal(res.body.transfers.length, 1);
    assert.equal(res.body.transfers[0].province, 'Lâm Đồng');
  });

  test('hỏi theo tỉnh -> lọc khách sạn theo tỉnh', async () => {
    const res = await api('POST', '/ai/search', { body: { query: 'Khách sạn ở Lâm Đồng' } });
    assert.deepEqual(res.body.rooms.map((r) => r.hotelId), [daLatHotel.hotel._id.toString()]);
    assert.equal(res.body.transfers.length, 0); // không hỏi xe -> không gợi ý xe
  });

  test('RagLog lưu tuyến xe đã gợi ý', async () => {
    const query = 'Xe đưa đón sân bay Lâm Đồng';
    await api('POST', '/ai/search', { body: { query } });
    await new Promise((r) => setTimeout(r, 300));
    const log = await RagLog.findOne({ userQuery: query });
    assert.equal(log.retrievedTransferRouteIds.length, 1);
    assert.equal(log.retrievedContextIds.length, 0);
    assert.equal(log.pipelineStats.transferResults, 1);
  });
});
