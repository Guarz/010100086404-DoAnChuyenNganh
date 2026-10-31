// File: tests/helpers.js
// Hạ tầng test API: DB riêng (BẮT BUỘC tên kết thúc bằng _test), app chạy trên cổng ngẫu nhiên.
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.VNP_HASH_SECRET = 'test-vnpay-secret';
process.env.GEMINI_API_KEY = ''; // Không gọi AI thật khi test -> kiểm tra luôn nhánh fallback

const TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/hotelrag_test';

const createApp = require('../createApp');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomInventory = require('../models/RoomInventory');

const DAY_MS = 24 * 60 * 60 * 1000;

async function startTestServer() {
  const dbName = new URL(TEST_MONGO_URI.replace('mongodb+srv', 'mongodb')).pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Từ chối chạy test: tên database "${dbName}" phải kết thúc bằng _test (test sẽ XÓA toàn bộ dữ liệu).`);
  }
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.db.dropDatabase();
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));

  const server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const api = async (method, url, { token, body, headers = {} } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  const stop = async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  };

  return { api, base, stop };
}

const tokenFor = (user) => jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET);

let userSeq = 0;
async function createUser(role, extra = {}) {
  userSeq += 1;
  const user = await User.create({
    fullName: `${role} ${userSeq}`, email: `${role.toLowerCase()}${userSeq}@test.vn`, password: 'x', role, ...extra
  });
  return { user, token: tokenFor(user) };
}

// Ngày dạng YYYY-MM-DD theo giờ địa phương, cách hôm nay n ngày
const ymd = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Khách sạn đã duyệt + 1 hạng phòng + quỹ phòng `days` ngày tới với số phòng trống `stock`
async function createHotelWithRoom(partner, { stock = 5, days = 10, basePrice = 1000000, city = 'Đà Nẵng', room = {} } = {}) {
  const hotel = await Hotel.create({
    partnerId: partner._id, hotelName: `KS ${partner.fullName}`, description: 'Khách sạn test',
    address: { street: '1 Test', city, province: city }, amenities: ['Wifi'], status: 'Approved'
  });
  const roomType = await RoomType.create({
    hotelId: hotel._id, title: 'Deluxe', basePrice, maxAdults: 2, maxChildren: 1, totalQuantity: Math.max(stock, 1),
    amenities: ['Smart TV'], ...room
  });
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  await RoomInventory.insertMany(Array.from({ length: days }, (_, i) => ({
    roomTypeId: roomType._id, date: new Date(todayUtc + i * DAY_MS), availableRooms: stock, dynamicPrice: basePrice
  })));
  return { hotel, roomType };
}

// Số phòng trống của một đêm (offset ngày so với hôm nay)
async function stockOn(roomTypeId, offset) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) + offset * DAY_MS);
  return (await RoomInventory.findOne({ roomTypeId, date })).availableRooms;
}

module.exports = { startTestServer, createUser, createHotelWithRoom, stockOn, ymd, tokenFor, DAY_MS };
