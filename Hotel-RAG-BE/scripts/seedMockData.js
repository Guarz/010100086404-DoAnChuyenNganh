// File: scripts/seedMockData.js
// Chuẩn hóa dữ liệu + bổ sung dữ liệu mock cho Hotel-RAG. Chạy từ thư mục gốc dự án:
//   node Hotel-RAG-BE/scripts/seedMockData.js               -> sửa & seed
//   node Hotel-RAG-BE/scripts/seedMockData.js --embeddings  -> thêm: tạo lại Vector AI bị thiếu/hỏng (gọi Gemini)
//
// Script IDEMPOTENT: dùng _id cố định + upsert nên chạy lại nhiều lần không sinh dữ liệu trùng.
// Không xóa dữ liệu thật; chỉ thay ảnh hỏng, điền trường thiếu và thêm bản ghi mock.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomInventory = require('../models/RoomInventory');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Review = require('../models/Review');

const DEMO_PASSWORD = 'Nestly@2026'; // Mật khẩu chung cho các tài khoản mock (*@nestly.test)
const INVENTORY_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const oid = (hex) => new mongoose.Types.ObjectId(hex);
const pad = (n, len) => String(n).padStart(len, '0');

// PRNG cố định để mỗi lần chạy sinh ra cùng một bộ dữ liệu
let seed = 20261031;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const unsplash = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;
const HOTEL_IMAGES = [
  'photo-1566073771259-6a8506099945', 'photo-1571896349842-33c89424de2d', 'photo-1520250497591-112f2f40a3f4',
  'photo-1582719508461-905c673771fd', 'photo-1564501049412-61c2a3083791', 'photo-1445019980597-93fa8acb246c',
  'photo-1455587734955-081b22074882', 'photo-1496417263034-38ec4f0b665a', 'photo-1517840901100-8179e982acb7',
  'photo-1584132967334-10e028bd69f7', 'photo-1561501900-3701fa6a0864', 'photo-1590381105924-c72589b9ef3f',
  'photo-1578683010236-d716f9a3f461', 'photo-1512918728675-ed5a9ecdebfd', 'photo-1563911302283-d2bc129e7570',
  'photo-1621293954908-907159247fc8', 'photo-1510798831971-661eb04b3739', 'photo-1580587771525-78b9dba3b914',
  'photo-1559599238-308793637427', 'photo-1528127269322-539801943592', 'photo-1583417319070-4a69db38a482',
  'photo-1570213489059-0aac6626cade', 'photo-1559592413-7cec4d0cae2b'
].map(unsplash);
const ROOM_IMAGES = [
  'photo-1631049307264-da0ec9d70304', 'photo-1590490360182-c33d57733427', 'photo-1611892440504-42a792e24d32',
  'photo-1618773928121-c32242e63f39', 'photo-1595576508898-0ad5c879a061', 'photo-1566665797739-1674de7a421a',
  'photo-1596394516093-501ba68a0ba6', 'photo-1505693416388-ac5ce068fe85', 'photo-1540518614846-7eded433c457',
  'photo-1564013799919-ab600027ffc6'
].map(unsplash);

const CITY_COORDS = {
  'Đà Nẵng': [108.2208, 16.0544], 'Đà Lạt': [108.4583, 11.9404], 'Hà Nội': [105.8342, 21.0278],
  'Hồ Chí Minh': [106.7009, 10.7769], 'Phú Quốc': [103.984, 10.2899], 'Huế': [107.5909, 16.4637],
  'Nha Trang': [109.1967, 12.2388], 'Hội An': [108.3275, 15.8801]
};

// ---------- Kiểm tra URL ảnh còn sống (cache theo URL) ----------
const urlCache = new Map();
const isImageAlive = async (url) => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url) || url.includes('example.com')) return false;
  if (!urlCache.has(url)) {
    urlCache.set(url, fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
      .then((res) => res.ok && (res.headers.get('content-type') || '').startsWith('image/'))
      .catch(() => false));
  }
  return urlCache.get(url);
};
const repairImages = async (images, pool, offset, minCount) => {
  const alive = [];
  for (const url of images || []) if (await isImageAlive(url)) alive.push(url);
  for (let i = 0; alive.length < minCount && i < pool.length; i++) {
    const candidate = pool[(offset + i) % pool.length];
    if (!alive.includes(candidate)) alive.push(candidate);
  }
  return alive;
};

const stats = {};
const count = (key, n = 1) => { stats[key] = (stats[key] || 0) + n; };

// =====================================================================
async function fixIndexes() {
  // Model khai báo unique nhưng trên Atlas index đang là index thường -> tạo lại
  const targets = [
    [User, 'email_1', { email: 1 }],
    [Review, 'bookingId_1', { bookingId: 1 }],
    [RoomInventory, 'roomTypeId_1_date_1', { roomTypeId: 1, date: 1 }]
  ];
  for (const [Model, name, key] of targets) {
    const indexes = await Model.collection.indexes();
    const current = indexes.find((i) => i.name === name);
    if (current && current.unique) continue;
    if (current) await Model.collection.dropIndex(name);
    await Model.collection.createIndex(key, { unique: true, name });
    count(`index unique: ${Model.collection.collectionName}.${name}`);
  }

  // Collection rỗng không thuộc model nào (tạo nhầm) -> chỉ xóa khi thực sự rỗng
  const db = mongoose.connection.db;
  for (const name of ['RagLog', 'ratings']) {
    const exists = await db.listCollections({ name }).hasNext();
    if (exists && (await db.collection(name).countDocuments()) === 0) {
      await db.collection(name).drop();
      count(`drop empty collection: ${name}`);
    }
  }
}

// =====================================================================
const MOCK_CUSTOMERS = [
  'Trần Minh Anh', 'Lê Hoàng Nam', 'Phạm Thu Hà', 'Võ Quốc Bảo', 'Đặng Ngọc Linh', 'Bùi Gia Huy',
  'Hoàng Mai Phương', 'Ngô Đức Thịnh', 'Huỳnh Bảo Ngọc', 'Dương Khánh Vy', 'Phan Tuấn Kiệt', 'Lý Thanh Trúc'
].map((fullName, i) => ({
  _id: oid(`6d0c0000000000000000c${pad(i + 1, 3)}`),
  fullName,
  email: `mock.customer${i + 1}@nestly.test`,
  phone: `09${pad(10000000 + i * 1234567, 8)}`
}));

async function fixUsers() {
  // Enum sai ('approve') / thiếu partnerApplicationStatus
  let r = await User.collection.updateMany(
    { partnerApplicationStatus: { $nin: ['NotRequested', 'Pending', 'Approved', 'Rejected'] }, role: 'Partner' },
    { $set: { partnerApplicationStatus: 'Approved' } }
  );
  count('users: fix partnerApplicationStatus (Partner)', r.modifiedCount);
  r = await User.collection.updateMany(
    { partnerApplicationStatus: { $nin: ['NotRequested', 'Pending', 'Approved', 'Rejected'] } },
    { $set: { partnerApplicationStatus: 'NotRequested' } }
  );
  count('users: fix partnerApplicationStatus (khác)', r.modifiedCount);

  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Partner bị khách sạn tham chiếu nhưng không tồn tại
  const hotelPartnerIds = await Hotel.distinct('partnerId');
  for (const partnerId of hotelPartnerIds) {
    if (await User.exists({ _id: partnerId })) continue;
    await User.collection.insertOne({
      _id: partnerId, fullName: 'Edensee & Mường Thanh Group', email: `partner.${partnerId.toString().slice(-6)}@nestly.test`,
      password, phone: '0909000001', role: 'Partner', status: 'Active', partnerApplicationStatus: 'Approved',
      createdAt: new Date(), updatedAt: new Date(), __v: 0
    });
    count('users: tạo partner bị thiếu');
  }

  for (const c of MOCK_CUSTOMERS) {
    const res = await User.collection.updateOne({ _id: c._id }, {
      $setOnInsert: { ...c, password, role: 'Customer', status: 'Active', partnerApplicationStatus: 'NotRequested',
        address: { city: pick(Object.keys(CITY_COORDS)) }, createdAt: new Date(Date.now() - 60 * DAY_MS), updatedAt: new Date(), __v: 0 }
    }, { upsert: true });
    count('users: thêm customer mock', res.upsertedCount);
  }
}

// =====================================================================
const ROOM_TEMPLATES = [
  { suffix: 'Standard Double', factor: 1, maxAdults: 2, maxChildren: 1, qty: 12, amenities: ['Wifi miễn phí', 'Điều hòa', 'Smart TV', 'Bàn làm việc'] },
  { suffix: 'Deluxe View', factor: 1.6, maxAdults: 2, maxChildren: 1, qty: 8, amenities: ['Ban công', 'Bồn tắm', 'Minibar', 'Wifi miễn phí'] },
  { suffix: 'Family Suite', factor: 2.6, maxAdults: 4, maxChildren: 2, qty: 4, amenities: ['Phòng khách riêng', '2 phòng ngủ', 'Bếp nhỏ', 'Bồn tắm'] }
];
const BASE_PRICE_BY_CITY = { 'Hà Nội': 1200000, 'Hồ Chí Minh': 1300000, 'Phú Quốc': 1800000, 'Đà Nẵng': 1000000, 'Đà Lạt': 900000, 'Nha Trang': 950000, 'Hội An': 800000, 'Huế': 700000 };

async function fixHotelsAndRooms() {
  const hotels = await Hotel.find().select('-embedding').sort({ _id: 1 });

  for (const [index, hotel] of hotels.entries()) {
    const update = {};
    const images = await repairImages(hotel.images, HOTEL_IMAGES, index * 3, 5);
    if (JSON.stringify(images) !== JSON.stringify(hotel.images)) { update.images = images; count('hotels: sửa/bổ sung ảnh'); }

    const coords = CITY_COORDS[hotel.address?.city];
    if (!hotel.coordinates?.coordinates?.length && coords) {
      update.coordinates = { type: 'Point', coordinates: coords };
      count('hotels: bổ sung tọa độ');
    }
    if (Object.keys(update).length) await Hotel.collection.updateOne({ _id: hotel._id }, { $set: update });

    // Khách sạn đã duyệt mà chưa có hạng phòng -> không bao giờ xuất hiện trong tìm kiếm
    const existingRooms = await RoomType.countDocuments({ hotelId: hotel._id });
    if (hotel.status === 'Approved' && existingRooms === 0) {
      const basePrice = BASE_PRICE_BY_CITY[hotel.address?.city] || 1000000;
      for (const [t, tpl] of ROOM_TEMPLATES.slice(0, 2 + (index % 2)).entries()) {
        const title = `${tpl.suffix} - ${hotel.hotelName.replace('[TEST] ', '')}`;
        await RoomType.updateOne({ hotelId: hotel._id, title }, {
          $setOnInsert: {
            description: `Hạng phòng ${tpl.suffix} tại ${hotel.hotelName}, rộng rãi, sạch sẽ, phù hợp cho ${tpl.maxAdults} người lớn.`,
            basePrice: Math.round((basePrice * tpl.factor) / 50000) * 50000,
            maxAdults: tpl.maxAdults, maxChildren: tpl.maxChildren, totalQuantity: tpl.qty,
            amenities: tpl.amenities, images: [ROOM_IMAGES[(index + t) % ROOM_IMAGES.length], ROOM_IMAGES[(index + t + 4) % ROOM_IMAGES.length]],
            isActive: true
          }
        }, { upsert: true });
        count('roomtypes: thêm hạng phòng cho KS trống');
      }
    }
  }

  // Sửa từng hạng phòng: ảnh hỏng, thiếu trường mặc định
  const rooms = await RoomType.find().sort({ _id: 1 });
  for (const [index, room] of rooms.entries()) {
    const update = {};
    const images = await repairImages(room.images, ROOM_IMAGES, index * 2, 2);
    if (JSON.stringify(images) !== JSON.stringify(room.images)) { update.images = images; count('roomtypes: sửa/bổ sung ảnh'); }
    const raw = await RoomType.collection.findOne({ _id: room._id });
    if (raw.isActive === undefined) update.isActive = true;
    if (raw.maxChildren === undefined) update.maxChildren = 0;
    if (!raw.amenities || raw.amenities.length === 0) update.amenities = ['Wifi miễn phí', 'Điều hòa', 'Smart TV'];
    if (!raw.description) update.description = `${room.title}: phòng tiêu chuẩn cho ${room.maxAdults} người lớn, đầy đủ tiện nghi.`;
    if (Object.keys(update).length > (update.images ? 1 : 0)) count('roomtypes: điền trường thiếu');
    if (Object.keys(update).length) await RoomType.collection.updateOne({ _id: room._id }, { $set: update });
  }
}

// =====================================================================
const utcToday = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };

async function extendInventory() {
  // Mở bán INVENTORY_DAYS ngày tới cho mọi hạng phòng đang hoạt động; ngày đã có thì giữ nguyên
  const rooms = await RoomType.find({ isActive: { $ne: false } }).select('basePrice totalQuantity');
  const start = utcToday();
  for (const room of rooms) {
    const ops = [];
    for (let i = 0; i < INVENTORY_DAYS; i++) {
      const date = new Date(start + i * DAY_MS);
      const weekend = [5, 6].includes(date.getUTCDay()); // Đêm thứ 6, thứ 7 tăng giá 20%
      ops.push({ updateOne: {
        filter: { roomTypeId: room._id, date },
        update: { $setOnInsert: { availableRooms: room.totalQuantity, dynamicPrice: Math.round(room.basePrice * (weekend ? 1.2 : 1)) } },
        upsert: true
      } });
    }
    const res = await RoomInventory.bulkWrite(ops, { ordered: false });
    count('roominventories: mở bán thêm ngày', res.upsertedCount);
  }
}

// =====================================================================
const REVIEW_TEXTS = {
  5: ['Tuyệt vời! Phòng sạch, view đẹp, nhân viên cực kỳ thân thiện. Chắc chắn sẽ quay lại.',
      'Kỳ nghỉ hoàn hảo cho gia đình, bữa sáng đa dạng và hồ bơi rất đẹp.',
      'Dịch vụ chuyên nghiệp, check-in nhanh, phòng thơm và yên tĩnh. 10 điểm!',
      'Vị trí thuận tiện, phòng rộng hơn mong đợi, giường ngủ rất êm.'],
  4: ['Phòng đẹp, sạch sẽ. Bữa sáng hơi ít món nhưng nhìn chung rất hài lòng.',
      'Nhân viên nhiệt tình, vị trí tốt. Wifi đôi lúc hơi chậm.',
      'Không gian thoáng, đáng tiền. Chỉ tiếc là hồ bơi hơi đông vào cuối tuần.',
      'Trải nghiệm tốt, phòng đúng như hình. Sẽ giới thiệu cho bạn bè.'],
  3: ['Tạm ổn so với giá tiền. Cách âm chưa tốt lắm.',
      'Phòng sạch nhưng nội thất hơi cũ, nhân viên lễ tân thân thiện.',
      'Vị trí đẹp nhưng check-in phải chờ khá lâu.'],
  2: ['Phòng không giống ảnh, điều hòa hoạt động kém. Cần cải thiện.',
      'Dịch vụ dọn phòng chậm, phải nhắc nhiều lần.']
};
const RATING_WEIGHTS = [5, 5, 5, 4, 4, 4, 4, 3, 3, 2];

const bookingId = (h, k) => oid(`6d0cb0${pad(h, 4)}${pad(k, 4)}0000000000`);
const paymentId = (h, k) => oid(`6d0cc0${pad(h, 4)}${pad(k, 4)}0000000000`);
const reviewId = (h, k) => oid(`6d0cd0${pad(h, 4)}${pad(k, 4)}0000000000`);

async function upsertBooking({ _id, payment, review, reserve, ...doc }) {
  const res = await Booking.collection.updateOne({ _id }, {
    $setOnInsert: { ...doc, specialRequests: doc.specialRequests || '', createdAt: doc.createdAt || new Date(), updatedAt: new Date(), __v: 0 }
  }, { upsert: true });
  if (!res.upsertedCount) return;
  count(`bookings: thêm ${doc.bookingStatus}`);

  // Đơn tương lai đã thanh toán -> trừ quỹ phòng như luồng thật (chỉ khi vừa được tạo)
  if (reserve) {
    for (const d of doc.bookingDetails) {
      await RoomInventory.updateMany(
        { roomTypeId: d.roomTypeId, date: { $gte: doc.checkInDate, $lt: doc.checkOutDate } },
        { $inc: { availableRooms: -d.quantity } }
      );
    }
  }
  if (payment) {
    await Payment.collection.updateOne({ _id: payment._id }, {
      $setOnInsert: { bookingId: _id, amount: doc.totalAmount, createdAt: payment.paymentDate || doc.createdAt, updatedAt: new Date(), __v: 0, ...payment }
    }, { upsert: true });
    count(`payments: thêm ${payment.paymentStatus}`);
  }
  if (review) {
    await Review.collection.updateOne({ _id: review._id }, {
      $setOnInsert: { bookingId: _id, customerId: doc.customerId, hotelId: doc.hotelId, createdAt: review.createdAt, updatedAt: review.createdAt, __v: 0, ...review }
    }, { upsert: true });
    count('reviews: thêm');
  }
}

const makeBooking = (hotel, room, customerId, checkIn, nights, quantity, status) => {
  const totalAmount = room.basePrice * nights * quantity;
  return {
    customerId, hotelId: hotel._id, checkInDate: checkIn, checkOutDate: new Date(checkIn.getTime() + nights * DAY_MS),
    totalAmount, bookingStatus: status,
    bookingDetails: [{ _id: new mongoose.Types.ObjectId(), roomTypeId: room._id, quantity, unitPrice: room.basePrice, totalNights: nights }]
  };
};

// Ngày nhận phòng theo giờ VN (00:00 +07 = 17:00Z hôm trước), giống bookingController.parseDateOnly
const vnDate = (offsetDays) => new Date(utcToday() + offsetDays * DAY_MS - 7 * 60 * 60 * 1000);

async function seedBookingsAndReviews() {
  const hotels = await Hotel.find({ status: 'Approved' }).select('_id hotelName').sort({ _id: 1 });
  const roomsByHotel = new Map();
  for (const room of await RoomType.find({ isActive: { $ne: false } }).sort({ basePrice: 1 })) {
    const key = room.hotelId.toString();
    if (!roomsByHotel.has(key)) roomsByHotel.set(key, []);
    roomsByHotel.get(key).push(room);
  }

  for (const [h, hotel] of hotels.entries()) {
    const rooms = roomsByHotel.get(hotel._id.toString());
    if (!rooms?.length) continue;

    // 1) 2-5 đơn đã hoàn thành trong quá khứ, mỗi đơn có thanh toán + đánh giá
    const completedCount = 2 + (h % 4);
    for (let k = 0; k < completedCount; k++) {
      const customer = MOCK_CUSTOMERS[(h * 3 + k) % MOCK_CUSTOMERS.length];
      const room = pick(rooms);
      const nights = 1 + Math.floor(rand() * 3);
      const checkIn = vnDate(-(10 + k * 9 + Math.floor(rand() * 6)));
      const doc = makeBooking(hotel, room, customer._id, checkIn, nights, 1, 'Completed');
      const paidAt = new Date(checkIn.getTime() - (3 + k) * DAY_MS);
      const rating = pick(RATING_WEIGHTS);
      await upsertBooking({
        _id: bookingId(h, k), ...doc, createdAt: paidAt,
        payment: { _id: paymentId(h, k), paymentMethod: 'VNPay', paymentStatus: 'Success', paymentDate: paidAt },
        review: { _id: reviewId(h, k), rating, comment: pick(REVIEW_TEXTS[rating]), createdAt: new Date(doc.checkOutDate.getTime() + DAY_MS) }
      });
    }

    // 2) 1-2 đơn sắp tới đã thanh toán (một số nhận phòng hôm nay) -> Partner thấy trong lịch nhận phòng
    for (let k = 0; k < 1 + (h % 2); k++) {
      const customer = MOCK_CUSTOMERS[(h + k + 5) % MOCK_CUSTOMERS.length];
      const room = rooms[0];
      const doc = makeBooking(hotel, room, customer._id, vnDate(h % 3 === 0 && k === 0 ? 0 : 2 + h + k * 5), 2, 1, 'Confirmed');
      await upsertBooking({
        _id: bookingId(h, 100 + k), ...doc, reserve: true, createdAt: new Date(Date.now() - DAY_MS),
        specialRequests: k === 0 ? pick(['Phòng tầng cao', 'Nhận phòng sớm nếu có thể', 'Giường phụ cho bé', '']) : '',
        payment: { _id: paymentId(h, 100 + k), paymentMethod: 'VNPay', paymentStatus: 'Success', paymentDate: new Date(Date.now() - DAY_MS) }
      });
    }

    // 3) Mỗi 4 khách sạn: 1 đơn bị hủy do thanh toán thất bại (minh họa log Payment Failed)
    if (h % 4 === 1) {
      const doc = makeBooking(hotel, rooms[0], MOCK_CUSTOMERS[h % MOCK_CUSTOMERS.length]._id, vnDate(7), 1, 1, 'Canceled');
      await upsertBooking({
        _id: bookingId(h, 200), ...doc, createdAt: new Date(Date.now() - 2 * DAY_MS),
        payment: { _id: paymentId(h, 200), paymentMethod: 'VNPay', paymentStatus: 'Failed' }
      });
    }
  }

  // 4) Tài khoản demo có sẵn: 1 đơn Completed CHƯA đánh giá để thử chức năng Review
  for (const [i, email] of ['user@nestly.com', 'nguyenvanb@gmail.com', 'khachhang@gmail.com'].entries()) {
    const user = await User.findOne({ email }).select('_id');
    const hotel = hotels[(i * 4) % hotels.length];
    const room = roomsByHotel.get(hotel?._id.toString())?.[0];
    if (!user || !room) continue;
    const doc = makeBooking(hotel, room, user._id, vnDate(-6 - i), 2, 1, 'Completed');
    await upsertBooking({
      _id: bookingId(9000 + i, 0), ...doc, createdAt: new Date(doc.checkInDate.getTime() - 5 * DAY_MS),
      payment: { _id: paymentId(9000 + i, 0), paymentMethod: 'VNPay', paymentStatus: 'Success', paymentDate: new Date(doc.checkInDate.getTime() - 5 * DAY_MS) }
    });
  }
}

// =====================================================================
async function recalculateRatings() {
  const stats = await Review.aggregate([{ $group: { _id: '$hotelId', avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  const byHotel = new Map(stats.map((s) => [s._id.toString(), s]));
  for (const hotel of await Hotel.find().select('_id rating reviewCount')) {
    const s = byHotel.get(hotel._id.toString());
    const rating = s ? Math.round(s.avg * 10) / 10 : 0;
    const reviewCount = s ? s.n : 0;
    if (hotel.rating !== rating || hotel.reviewCount !== reviewCount) {
      await Hotel.collection.updateOne({ _id: hotel._id }, { $set: { rating, reviewCount } });
      count('hotels: tính lại rating từ reviews');
    }
  }
}

async function regenerateEmbeddings() {
  const { generateHotelEmbedding } = require('../services/aiService');
  const hotels = await Hotel.aggregate([
    { $match: { status: 'Approved' } },
    { $project: { hotelName: 1, description: 1, amenities: 1, address: 1, dims: { $size: { $ifNull: ['$embedding', []] } } } },
    { $match: { dims: { $ne: 3072 } } }
  ]);
  for (const hotel of hotels) {
    const embedding = await generateHotelEmbedding(hotel);
    if (embedding.length === 3072) {
      await Hotel.collection.updateOne({ _id: hotel._id }, { $set: { embedding } });
      count('hotels: tạo lại Vector AI');
    } else {
      console.warn(`  ! Không tạo được embedding cho ${hotel.hotelName}`);
    }
  }
}

// =====================================================================
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Đã kết nối: ${mongoose.connection.name}`);

  const steps = [
    ['Index & collection thừa', fixIndexes],
    ['Users', fixUsers],
    ['Hotels & RoomTypes', fixHotelsAndRooms],
    ['RoomInventory', extendInventory],
    ['Bookings / Payments / Reviews', seedBookingsAndReviews],
    ['Rating khách sạn', recalculateRatings]
  ];
  if (process.argv.includes('--embeddings')) steps.push(['Vector AI', regenerateEmbeddings]);

  for (const [label, fn] of steps) {
    process.stdout.write(`- ${label}... `);
    await fn();
    console.log('xong');
  }

  console.log('\nKết quả:');
  for (const [key, n] of Object.entries(stats)) if (n) console.log(`  ${key}: ${n}`);
  if (!Object.values(stats).some(Boolean)) console.log('  Không có gì thay đổi (dữ liệu đã chuẩn).');
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
