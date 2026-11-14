// File: tests/provinces.test.js
// Danh mục cố định 63 tỉnh/thành: chuẩn hóa, chặn giá trị nhập tay sai, lọc khách sạn / xe theo tỉnh.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { startTestServer, createUser, createHotelWithRoom } = require('./helpers');
const { VN_PROVINCES, normalizeProvince } = require('../constants/provinces');
const Hotel = require('../models/Hotel');

let api, stop;
before(async () => { ({ api, stop } = await startTestServer()); });
after(() => stop());

describe('Danh mục 63 tỉnh/thành', () => {
  test('đủ 63 tỉnh, không trùng, sắp xếp A→Z tiếng Việt', () => {
    assert.equal(VN_PROVINCES.length, 63);
    assert.equal(new Set(VN_PROVINCES).size, 63);
    assert.deepEqual([...VN_PROVINCES].sort((a, b) => a.localeCompare(b, 'vi')), [...VN_PROVINCES]);
  });

  test('frontend dùng đúng cùng danh sách với backend', async () => {
    const file = path.join(__dirname, '../../Hotel-RAG-FE/src/constants/provinces.js');
    const { VN_PROVINCES: fe } = await import(pathToFileURL(file).href);
    assert.deepEqual(fe, [...VN_PROVINCES]);
  });

  test('chuẩn hóa cách viết khác và địa danh', () => {
    assert.equal(normalizeProvince('tp. Hồ Chí Minh'), 'Hồ Chí Minh');
    assert.equal(normalizeProvince('Huế'), 'Thừa Thiên Huế');
    assert.equal(normalizeProvince('Đà Lạt'), 'Lâm Đồng');
    assert.equal(normalizeProvince('tinh quang nam'), 'Quảng Nam');
    assert.equal(normalizeProvince('Gotham'), null);
  });

  test('model từ chối tỉnh ngoài danh mục', async () => {
    const { user } = await createUser('Partner');
    await assert.rejects(Hotel.create({ partnerId: user._id, hotelName: 'X', description: 'Y', address: { city: 'A', province: 'Gotham' } }));
  });
});

describe('Khách sạn theo tỉnh', () => {
  let partner;
  before(async () => {
    partner = await createUser('Partner');
    await createHotelWithRoom(partner.user, { city: 'Đà Lạt' }); // province -> Lâm Đồng
    await createHotelWithRoom(partner.user, { city: 'Hà Nội' });
  });

  test('GET /hotels/provinces trả 63 tỉnh kèm số khách sạn', async () => {
    const res = await api('GET', '/hotels/provinces');
    assert.equal(res.body.data.length, 63);
    assert.equal(res.body.data.find((p) => p.name === 'Lâm Đồng').hotelCount, 1);
    assert.equal(res.body.data.find((p) => p.name === 'Yên Bái').hotelCount, 0);
  });

  test('lọc ?province= chính xác; tỉnh sai -> 400; ?city=Đà Lạt cũ vẫn chạy', async () => {
    let res = await api('GET', `/hotels/search?province=${encodeURIComponent('Lâm Đồng')}`);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].address.province, 'Lâm Đồng');
    assert.equal((await api('GET', '/hotels/search?province=Gotham')).status, 400);
    res = await api('GET', `/hotels/search?city=${encodeURIComponent('Đà Lạt')}`);
    assert.equal(res.body.data.length, 1);
  });

  test('Partner tạo / sửa khách sạn: tỉnh ngoài danh mục bị chặn, cách viết khác được chuẩn hóa', async () => {
    const body = (province) => ({ hotelName: 'KS Tỉnh', description: 'Khách sạn kiểm thử tỉnh', address: { street: '1 A', city: 'Huế', province } });
    assert.equal((await api('POST', '/partner/hotels', { token: partner.token, body: body('Gotham') })).status, 400);
    assert.equal((await api('POST', '/partner/hotels', { token: partner.token, body: body('') })).status, 400);
    const res = await api('POST', '/partner/hotels', { token: partner.token, body: body('Huế') });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.address.province, 'Thừa Thiên Huế');

    const id = res.body.data._id;
    assert.equal((await api('PUT', `/partner/hotels/${id}`, { token: partner.token, body: { address: { province: 'Mars' } } })).status, 400);
    const ok = await api('PUT', `/partner/hotels/${id}`, { token: partner.token, body: { address: { province: 'Quảng Trị' } } });
    assert.equal(ok.status, 200);
    assert.equal((await Hotel.findById(id)).address.province, 'Quảng Trị');
  });
});

describe('Hồ sơ người dùng và nhà xe', () => {
  test('PUT /users/me chỉ nhận tỉnh trong danh mục', async () => {
    const u = await createUser('Customer');
    assert.equal((await api('PUT', '/users/me', { token: u.token, body: { address: { province: 'Atlantis' } } })).status, 400);
    const res = await api('PUT', '/users/me', { token: u.token, body: { address: { province: 'Cần Thơ' } } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.address.province, 'Cần Thơ');
  });

  test('nhà xe: tỉnh phục vụ phải thuộc danh mục; tuyến chỉ mở ở tỉnh đã đăng ký', async () => {
    const admin = await createUser('Admin');
    const owner = await createUser('Customer');
    const apply = (serviceProvinces) => api('POST', '/transport/apply', {
      token: owner.token, body: { companyName: 'Xe Tỉnh', phone: '0905111222', licenseNumber: 'GP-T1', serviceProvinces }
    });
    assert.equal((await apply(['Gotham'])).status, 400);
    const res = await apply(['Đà Nẵng', 'Huế']);
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.data.serviceProvinces, ['Đà Nẵng', 'Thừa Thiên Huế']);
    await api('PUT', `/admin/transport-companies/${res.body.data._id}/status`, { token: admin.token, body: { status: 'Approved' } });

    const vehicle = (await api('POST', '/transport/vehicles', { token: owner.token, body: { name: 'Sedan', seats: 4, totalVehicles: 1 } })).body.data;
    const route = (province) => api('POST', `/transport/vehicles/${vehicle._id}/routes`, {
      token: owner.token, body: { province, fromPlace: 'Sân bay', toPlace: 'Trung tâm', price: 200000 }
    });
    assert.equal((await route('Hà Nội')).status, 400); // chưa đăng ký phục vụ Hà Nội
    assert.equal((await route('Atlantis')).status, 400);
    assert.equal((await route('Thừa Thiên Huế')).status, 201);
    assert.equal((await api('GET', '/transfers/search?province=Atlantis')).status, 400);
  });
});
