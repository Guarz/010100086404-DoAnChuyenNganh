// File: tests/transfer.test.js
// Xe đưa đón: đăng ký + duyệt nhà xe, phân quyền/sở hữu, tìm xe, đặt xe đồng thời, idempotency,
// hủy / cronjob trả xe, thanh toán VNPay cho đơn xe.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const qs = require('qs');
const { startTestServer, createUser, createHotelWithRoom } = require('./helpers');
const User = require('../models/User');
const VehicleInventory = require('../models/VehicleInventory');
const TransferBooking = require('../models/TransferBooking');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { releaseExpiredBookings } = require('../jobs/bookingCron');

const DAY_MS = 24 * 60 * 60 * 1000;
// Ngày (giờ VN) cách hôm nay n ngày, dạng YYYY-MM-DD
const vnDay = (n) => new Date(Date.now() + n * DAY_MS + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
const pickup = (n, hhmm = '10:00') => `${vnDay(n)}T${hhmm}`;
const stock = async (vehicleTypeId, n) =>
  (await VehicleInventory.findOne({ vehicleTypeId, date: new Date(`${vnDay(n)}T00:00:00Z`) })).availableVehicles;

let api, stop, admin, ownerA, ownerB, customer, companyA, vehicleA, routeA;

// Đăng ký nhà xe + Admin duyệt -> trả về { user, token, company }
const makeCompany = async (name, provinces = ['Đà Nẵng']) => {
  const u = await createUser('Customer');
  const res = await api('POST', '/transport/apply', {
    token: u.token, body: { companyName: name, phone: '0905123456', licenseNumber: `GP-${name}`, serviceProvinces: provinces }
  });
  assert.equal(res.status, 201);
  const ok = await api('PUT', `/admin/transport-companies/${res.body.data._id}/status`, { token: admin.token, body: { status: 'Approved' } });
  assert.equal(ok.status, 200);
  return { ...u, company: res.body.data };
};

before(async () => {
  ({ api, stop } = await startTestServer());
  admin = await createUser('Admin');
  customer = await createUser('Customer');
  ownerA = await makeCompany('Xe Biển Xanh');
  ownerB = await makeCompany('Xe Núi Đỏ');
  companyA = ownerA.company;
  vehicleA = (await api('POST', '/transport/vehicles', {
    token: ownerA.token, body: { name: 'Sedan 4 chỗ', seats: 4, luggage: 3, totalVehicles: 1, amenities: ['Điều hòa'] }
  })).body.data;
  routeA = (await api('POST', `/transport/vehicles/${vehicleA._id}/routes`, {
    token: ownerA.token, body: { province: 'Đà Nẵng', fromPlace: 'Sân bay Đà Nẵng', toPlace: 'Khu Mỹ Khê', price: 250000, durationMin: 20 }
  })).body.data;
});
after(() => stop());

describe('Đăng ký và duyệt nhà xe', () => {
  test('duyệt -> tài khoản thành Transport; từ chối -> trả về Customer', async () => {
    assert.equal((await User.findById(ownerA.user._id)).role, 'Transport');
    const u = await createUser('Customer');
    const res = await api('POST', '/transport/apply', {
      token: u.token, body: { companyName: 'Xe Tạm', phone: '0905000000', licenseNumber: 'GP-1', serviceProvinces: ['Huế'] }
    });
    await api('PUT', `/admin/transport-companies/${res.body.data._id}/status`, { token: admin.token, body: { status: 'Approved' } });
    await api('PUT', `/admin/transport-companies/${res.body.data._id}/status`, { token: admin.token, body: { status: 'Rejected', reason: 'Sai giấy phép' } });
    assert.equal((await User.findById(u.user._id)).role, 'Customer');
  });

  test('Partner không đăng ký làm nhà xe được; dữ liệu sai -> 400; nộp trùng -> 409', async () => {
    const partner = await createUser('Partner');
    assert.equal((await api('POST', '/transport/apply', { token: partner.token, body: { companyName: 'Xe X', phone: '0905000001', licenseNumber: 'GP-2', serviceProvinces: ['Huế'] } })).status, 409);
    assert.equal((await api('POST', '/transport/apply', { token: customer.token, body: { companyName: 'Xe', phone: 'abc', licenseNumber: 'GP', serviceProvinces: [] } })).status, 400);
    assert.equal((await api('POST', '/transport/apply', { token: ownerA.token, body: { companyName: 'Xe Mới', phone: '0905000002', licenseNumber: 'GP-3', serviceProvinces: ['Huế'] } })).status, 409);
  });

  test('tạo loại xe tự mở 60 ngày lịch xe', async () => {
    assert.equal(await VehicleInventory.countDocuments({ vehicleTypeId: vehicleA._id }), 60);
    assert.equal(await stock(vehicleA._id, 3), 1);
  });
});

describe('Phân quyền / sở hữu phía nhà xe', () => {
  test('Customer và Admin/khách chưa duyệt không quản lý xe được', async () => {
    assert.equal((await api('POST', '/transport/vehicles', { token: customer.token, body: { name: 'X', seats: 4, totalVehicles: 1 } })).status, 403);
    assert.equal((await api('GET', '/transport/bookings', { token: customer.token })).status, 403);
    assert.equal((await api('GET', '/admin/transport-companies', { token: ownerA.token })).status, 403);
  });

  test('Nhà xe B không sửa được loại xe / tuyến / lịch xe / đơn của nhà xe A', async () => {
    assert.equal((await api('PUT', `/transport/vehicles/${vehicleA._id}`, { token: ownerB.token, body: { name: 'Hack' } })).status, 403);
    assert.equal((await api('POST', `/transport/vehicles/${vehicleA._id}/routes`, { token: ownerB.token, body: { province: 'Đà Nẵng', fromPlace: 'A', toPlace: 'B', price: 100000 } })).status, 403);
    assert.equal((await api('PUT', `/transport/routes/${routeA._id}`, { token: ownerB.token, body: { price: 10000 } })).status, 403);
    assert.equal((await api('PUT', `/transport/vehicles/${vehicleA._id}/inventory`, { token: ownerB.token, body: { startDate: vnDay(1), endDate: vnDay(2), availableVehicles: 0 } })).status, 403);
    assert.equal((await api('GET', `/transport/vehicles/${vehicleA._id}/inventory`, { token: ownerB.token })).status, 403);
  });

  test('Nhà xe A sửa được xe của mình; số xe trống vượt tổng -> 400', async () => {
    assert.equal((await api('PUT', `/transport/vehicles/${vehicleA._id}`, { token: ownerA.token, body: { luggage: 4 } })).status, 200);
    assert.equal((await api('PUT', `/transport/vehicles/${vehicleA._id}/inventory`, { token: ownerA.token, body: { startDate: vnDay(1), endDate: vnDay(1), availableVehicles: 5 } })).status, 400);
  });
});

describe('Tìm xe đưa đón', () => {
  test('theo thành phố / khách sạn, tính số xe cần theo số khách, loại xe hết chỗ', async () => {
    const { user: partner } = await createUser('Partner');
    const { hotel } = await createHotelWithRoom(partner, { city: 'Đà Nẵng' });

    let res = await api('GET', `/transfers/search?hotelId=${hotel._id}&date=${vnDay(3)}&passengers=2`);
    assert.equal(res.status, 200);
    assert.equal(res.body.province, 'Đà Nẵng');
    assert.equal(res.body.data[0].fromPlace, 'Sân bay Đà Nẵng');
    assert.equal(res.body.data[0].availableVehicles, 1);

    res = await api('GET', `/transfers/search?province=${encodeURIComponent('Đà Nẵng')}&date=${vnDay(3)}&passengers=6`);
    assert.equal(res.body.data.length, 0); // 6 khách cần 2 xe 4 chỗ, chỉ có 1 xe

    const provinces = (await api('GET', '/transfers/provinces')).body.data;
    assert.equal(provinces.length, 63);
    assert.deepEqual(provinces.filter((p) => p.routeCount > 0).map((p) => p.name), ['Đà Nẵng']);
  });
});

describe('Đặt xe đồng thời, idempotency, hủy', () => {
  const body = (n = 5) => ({ routeId: routeA._id, pickupTime: pickup(n), passengers: 2, contactPhone: '0905999999', flightNumber: 'VN123' });

  test('còn 1 xe, 2 khách đặt ĐỒNG THỜI -> đúng 1 đơn, lịch xe = 0', async () => {
    const [a, b] = await Promise.all([createUser('Customer'), createUser('Customer')]);
    const results = await Promise.all([
      api('POST', '/transfers', { token: a.token, body: body(5) }),
      api('POST', '/transfers', { token: b.token, body: body(5) })
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
    assert.equal(await stock(vehicleA._id, 5), 0);
  });

  test('cùng Idempotency-Key gửi 2 lần đồng thời -> 1 đơn, trừ xe 1 lần', async () => {
    const u = await createUser('Customer');
    const headers = { 'Idempotency-Key': 'transfer-key-0001' };
    const [r1, r2] = await Promise.all([
      api('POST', '/transfers', { token: u.token, headers, body: body(6) }),
      api('POST', '/transfers', { token: u.token, headers, body: body(6) })
    ]);
    assert.equal(r1.body.data._id, r2.body.data._id);
    assert.equal(await TransferBooking.countDocuments({ customerId: u.user._id }), 1);
    assert.equal(await stock(vehicleA._id, 6), 0);
  });

  test('hủy đơn Pending trả xe; hủy lần 2 bị từ chối; khách khác không hủy được', async () => {
    const u = await createUser('Customer');
    const id = (await api('POST', '/transfers', { token: u.token, body: body(7) })).body.data._id;
    assert.equal(await stock(vehicleA._id, 7), 0);
    assert.equal((await api('PUT', `/transfers/${id}/cancel`, { token: customer.token })).status, 404);
    assert.equal((await api('PUT', `/transfers/${id}/cancel`, { token: u.token })).status, 200);
    assert.equal((await api('PUT', `/transfers/${id}/cancel`, { token: u.token })).status, 400);
    assert.equal(await stock(vehicleA._id, 7), 1);
  });

  test('cronjob hủy đơn quá hạn thanh toán và trả xe; mở lại trang thanh toán -> 410', async () => {
    const u = await createUser('Customer');
    const id = (await api('POST', '/transfers', { token: u.token, body: body(8) })).body.data._id;
    await TransferBooking.updateOne({ _id: id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await releaseExpiredBookings();
    assert.equal((await TransferBooking.findById(id)).status, 'Canceled');
    assert.equal(await stock(vehicleA._id, 8), 1);

    const id2 = (await api('POST', '/transfers', { token: u.token, body: body(9) })).body.data._id;
    await TransferBooking.updateOne({ _id: id2 }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await api('GET', `/transfers/${id2}`, { token: u.token })).status, 410);
    assert.equal(await stock(vehicleA._id, 9), 1);
  });

  test('giờ đón quá gần / đơn phòng của người khác -> từ chối', async () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000 + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
    assert.equal((await api('POST', '/transfers', { token: customer.token, body: { ...body(), pickupTime: soon } })).status, 400);
    const other = await createUser('Customer');
    const hb = await Booking.create({
      customerId: other.user._id, hotelId: companyA._id, checkInDate: new Date(), checkOutDate: new Date(), totalAmount: 1, bookingDetails: []
    });
    assert.equal((await api('POST', '/transfers', { token: customer.token, body: { ...body(10), hotelBookingId: hb._id } })).status, 404);
  });
});

describe('Thanh toán VNPay và đơn của nhà xe', () => {
  const sign = (params) => {
    const sorted = {};
    Object.keys(params).map(encodeURIComponent).sort().forEach((k) => { sorted[k] = encodeURIComponent(params[k]).replace(/%20/g, '+'); });
    const hash = crypto.createHmac('sha512', process.env.VNP_HASH_SECRET).update(Buffer.from(qs.stringify(sorted, { encode: false }), 'utf-8')).digest('hex');
    return qs.stringify({ ...sorted, vnp_SecureHash: hash }, { encode: false });
  };

  test('VNPay thành công -> đơn xe Confirmed + Payment gắn transferBookingId; nhà xe thấy đơn, nhà xe khác không', async () => {
    const u = await createUser('Customer');
    const booking = (await api('POST', '/transfers', {
      token: u.token, body: { routeId: routeA._id, pickupTime: pickup(11), passengers: 1, contactPhone: '0905888888' }
    })).body.data;

    assert.equal((await api('POST', '/payments/vnpay/create_url', { token: customer.token, body: { transferBookingId: booking._id } })).status, 403);

    const res = await api('GET', `/payments/vnpay/return?${sign({ vnp_TxnRef: booking._id, vnp_ResponseCode: '00', vnp_Amount: String(booking.totalAmount * 100) })}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.type, 'transfer');
    assert.equal((await TransferBooking.findById(booking._id)).status, 'Confirmed');
    const payment = await Payment.findOne({ transferBookingId: booking._id });
    assert.equal(payment.paymentStatus, 'Success');
    assert.equal(payment.amount, 250000);

    const mine = await api('GET', '/transport/bookings', { token: ownerA.token });
    assert.ok(mine.body.data.some((b) => b._id === booking._id));
    const theirs = await api('GET', '/transport/bookings', { token: ownerB.token });
    assert.ok(!theirs.body.data.some((b) => b._id === booking._id));
    assert.equal((await api('PUT', `/transport/bookings/${booking._id}/complete`, { token: ownerB.token })).status, 403);

    const history = await api('GET', '/transfers/my', { token: u.token });
    assert.equal(history.body.data[0].paid, true);
  });
});
