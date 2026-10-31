// File: tests/partner-edit-amenities.test.js
// Partner chỉnh sửa khách sạn / hạng phòng (gồm tiện nghi) và bộ lọc tiện nghi ở trang danh sách.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, createUser, createHotelWithRoom, stockOn, ymd } = require('./helpers');
const Hotel = require('../models/Hotel');
const RoomInventory = require('../models/RoomInventory');

let api, stop, owner, other, admin, hotel, room;

before(async () => {
  ({ api, stop } = await startTestServer());
  owner = await createUser('Partner');
  other = await createUser('Partner');
  admin = await createUser('Admin');
  ({ hotel, roomType: room } = await createHotelWithRoom(owner.user, { stock: 5, room: { amenities: ['Smart TV'] } }));
});
after(() => stop());

describe('Partner sửa khách sạn', () => {
  test('chủ KS sửa tên, mô tả, tiện nghi (chuẩn hóa: bỏ trùng, bỏ khoảng trắng)', async () => {
    const res = await api('PUT', `/partner/hotels/${hotel._id}`, {
      token: owner.token,
      body: { hotelName: 'KS Biển Xanh', description: 'Khách sạn gần biển Mỹ Khê', amenities: [' Hồ bơi ', 'hồ bơi', 'Spa', ''] }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.hotelName, 'KS Biển Xanh');
    assert.deepEqual(res.body.data.amenities, ['Hồ bơi', 'Spa']);
  });

  test('Partner khác bị chặn 403, Admin được phép', async () => {
    assert.equal((await api('PUT', `/partner/hotels/${hotel._id}`, { token: other.token, body: { amenities: [] } })).status, 403);
    assert.equal((await api('PUT', `/partner/hotels/${hotel._id}`, { token: admin.token, body: { amenities: ['Hồ bơi', 'Spa', 'Gym'] } })).status, 200);
  });

  test('dữ liệu sai bị từ chối 400 (URL ảnh, mô tả quá ngắn, rỗng)', async () => {
    assert.equal((await api('PUT', `/partner/hotels/${hotel._id}`, { token: owner.token, body: { images: ['javascript:alert(1)'] } })).status, 400);
    assert.equal((await api('PUT', `/partner/hotels/${hotel._id}`, { token: owner.token, body: { description: 'ngắn' } })).status, 400);
    assert.equal((await api('PUT', `/partner/hotels/${hotel._id}`, { token: owner.token, body: {} })).status, 400);
  });

  test('KS bị từ chối: sửa xong tự gửi duyệt lại (Pending)', async () => {
    const rejected = await Hotel.create({
      partnerId: owner.user._id, hotelName: 'KS Bị Từ Chối', description: 'Mô tả ban đầu đủ dài',
      address: { street: '1', city: 'Huế', province: 'Huế' }, status: 'Rejected', rejectionReason: 'Thiếu ảnh'
    });
    const res = await api('PUT', `/partner/hotels/${rejected._id}`, {
      token: owner.token, body: { images: ['https://images.unsplash.com/photo-1.jpg'] }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'Pending');
    assert.equal(res.body.data.rejectionReason, null);
  });

  test('tạo KS thiếu mô tả -> 400 (trước đây lỗi 500)', async () => {
    const res = await api('POST', '/partner/hotels', {
      token: owner.token, body: { hotelName: 'KS Mới', address: { street: '1', city: 'Huế', province: 'Huế' } }
    });
    assert.equal(res.status, 400);
  });
});

describe('Partner sửa hạng phòng', () => {
  test('sửa tiện nghi, mô tả, giá gốc, sức chứa', async () => {
    const res = await api('PUT', `/partner/rooms/${room._id}`, {
      token: owner.token,
      body: { description: 'Phòng 30m2 có ban công', amenities: ['Ban công', 'Bồn tắm', 'Smart TV'], basePrice: 1200000, maxChildren: 2 }
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.amenities, ['Ban công', 'Bồn tắm', 'Smart TV']);
    assert.equal(res.body.data.basePrice, 1200000);
    assert.equal(res.body.data.maxChildren, 2);
  });

  test('Partner khác bị chặn 403', async () => {
    assert.equal((await api('PUT', `/partner/rooms/${room._id}`, { token: other.token, body: { basePrice: 1000 } })).status, 403);
  });

  test('đổi tổng số phòng -> quỹ phòng từ hôm nay được cộng/trừ phần chênh lệch, không âm', async () => {
    // Giả lập đã có 2 phòng được đặt ở đêm +1
    const now = new Date();
    const night1 = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + 86400000);
    await RoomInventory.updateOne({ roomTypeId: room._id, date: night1 }, { $set: { availableRooms: 3 } });

    let res = await api('PUT', `/partner/rooms/${room._id}`, { token: owner.token, body: { totalQuantity: 8 } });
    assert.equal(res.status, 200);
    assert.equal(await stockOn(room._id, 0), 8);
    assert.equal(await stockOn(room._id, 1), 6); // 3 + 3, vẫn giữ 2 phòng đã đặt

    res = await api('PUT', `/partner/rooms/${room._id}`, { token: owner.token, body: { totalQuantity: 1 } });
    assert.equal(res.status, 200);
    assert.equal(await stockOn(room._id, 0), 1);
    assert.equal(await stockOn(room._id, 1), 0); // 6 - 7 -> chặn ở 0
  });

  test('giá trị sai -> 400', async () => {
    assert.equal((await api('PUT', `/partner/rooms/${room._id}`, { token: owner.token, body: { basePrice: -5 } })).status, 400);
    assert.equal((await api('PUT', `/partner/rooms/${room._id}`, { token: owner.token, body: { amenities: 'Wifi' } })).status, 400);
  });
});

describe('Bộ lọc tiện nghi trang danh sách', () => {
  before(async () => {
    const { user } = await createUser('Partner');
    // KS thứ 2 chỉ có Wifi ở cấp KS, nhưng hạng phòng có Bồn tắm
    await createHotelWithRoom(user, { city: 'Hà Nội', room: { title: 'Deluxe Bồn Tắm', amenities: ['Bồn tắm'] } });
  });

  test('GET /hotels/amenities trả danh mục chuẩn kèm số KS', async () => {
    const res = await api('GET', '/hotels/amenities');
    assert.equal(res.status, 200);
    const byLabel = Object.fromEntries(res.body.data.map((x) => [x.label, x.count]));
    assert.equal(byLabel['Bồn tắm'], 2); // KS 1 (phòng) + KS 2 (phòng)
    assert.equal(byLabel['Spa'], 1);
  });

  test('lọc nhiều tiện nghi = khách sạn phải có ĐỦ tất cả (xét cả tiện nghi hạng phòng)', async () => {
    const both = await api('GET', `/hotels/search?amenities=${encodeURIComponent('Bồn tắm,Spa')}`);
    assert.deepEqual(both.body.data.map((h) => h.hotelName), ['KS Biển Xanh']);
    const bath = await api('GET', `/hotels/search?amenities=${encodeURIComponent('Bồn tắm')}`);
    assert.equal(bath.body.data.length, 2);
    assert.ok(bath.body.data.every((h) => typeof h.priceFrom === 'number'));
  });

  test('nhãn không có trong danh mục bị bỏ qua; thành phố có ký tự đặc biệt không lỗi', async () => {
    const res = await api('GET', `/hotels/search?amenities=Bay%20lên%20trời&city=${encodeURIComponent('Đà (Nẵng')}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.amenities, []);
    assert.equal(res.body.data.length, 0);
  });

  test('lọc theo ngày + số phòng cần: phòng không đủ quỹ bị loại', async () => {
    const res = await api('GET', `/hotels/search?checkIn=${ymd(1)}&checkOut=${ymd(2)}&rooms=2&city=${encodeURIComponent('Đà Nẵng')}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0); // KS Biển Xanh đêm +1 chỉ còn 0 phòng
  });
});
