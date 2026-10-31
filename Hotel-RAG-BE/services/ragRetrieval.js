// File: services/ragRetrieval.js
// Bước 2-4 của pipeline RAG:
//   (2) Structured filtering : lọc hạng phòng bằng MongoDB theo ràng buộc cứng (thành phố, số khách,
//                              ngân sách, tiện nghi bắt buộc, loại phòng) -> không bao giờ vi phạm.
//   (3) Availability         : nếu khách cho ngày ở, chỉ giữ phòng còn đủ quỹ cho MỌI đêm,
//                              và tính giá theo giá động (dynamicPrice) của đúng các đêm đó.
//   (4) Semantic ranking      : xếp hạng phần còn lại theo độ tương đồng vector (sở thích mềm),
//                              kết hợp điểm từ khóa ở cấp hạng phòng.
// Ngoài ra cung cấp 2 baseline cho benchmark: keywordSearch() và atlasVectorSearch().
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomInventory = require('../models/RoomInventory');
const { amenityMatcher, roomKindMatcher, plain } = require('./queryConstraintParser');

const DAY_MS = 24 * 60 * 60 * 1000;
const STOPWORDS = new Set(('toi muon can tim cho co khong nao o tai mot cac nhung la va hay gi duoc phong khach san ' +
  'cua voi trong de thi nay do minh ban nhe a oi ah hien he thong').split(' '));

const tokenize = (text) => plain(text || '').split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));

const roomText = (room, hotel) => [
  room.title, room.description, (room.amenities || []).join(' '),
  hotel.hotelName, hotel.description, (hotel.amenities || []).join(' '),
  hotel.address?.city, hotel.address?.province, hotel.address?.street
].join(' ');

const cosine = (a, b) => {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

// Điểm từ khóa kiểu BM25 rút gọn trên toàn bộ tập tài liệu (dùng cho baseline keyword và xếp hạng phụ)
const buildKeywordScorer = (docs, query) => {
  const qTokens = [...new Set(tokenize(query))];
  const docTokens = docs.map((d) => tokenize(d.text));
  const avgLen = docTokens.reduce((s, t) => s + t.length, 0) / Math.max(docTokens.length, 1);
  const df = new Map(qTokens.map((t) => [t, docTokens.filter((tokens) => tokens.includes(t)).length]));
  const N = docs.length;
  return (index) => {
    const tokens = docTokens[index];
    let score = 0;
    for (const t of qTokens) {
      const tf = tokens.filter((x) => x === t).length;
      if (!tf) continue;
      const idf = Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
      score += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * tokens.length / avgLen)));
    }
    return score;
  };
};

// Tải toàn bộ hạng phòng đang bán của khách sạn đã duyệt (kèm khách sạn)
const loadRoomCatalog = async ({ withEmbedding = false } = {}) => {
  const hotels = await Hotel.find({ status: 'Approved' })
    .select(withEmbedding ? '' : '-embedding').lean();
  const hotelById = new Map(hotels.map((h) => [h._id.toString(), h]));
  const rooms = await RoomType.find({ isActive: { $ne: false }, hotelId: { $in: hotels.map((h) => h._id) } }).lean();
  return rooms.map((room) => {
    const hotel = hotelById.get(room.hotelId.toString());
    return { room, hotel, text: roomText(room, hotel) };
  });
};

// (2) Lọc theo ràng buộc cứng — trả về danh sách {room, hotel, text} thỏa mãn
const applyHardFilters = (catalog, c) => catalog.filter(({ room, hotel }) => {
  if (c.city && hotel.address?.city !== c.city) return false;
  if (c.adults && room.maxAdults < c.adults) return false;
  if (c.children && (room.maxChildren || 0) < c.children) return false;
  if (c.rooms && room.totalQuantity < c.rooms) return false;
  for (const label of c.amenities) {
    const re = amenityMatcher(label);
    const haystack = [room.title, room.description, ...(room.amenities || []), ...(hotel.amenities || [])].join(' | ');
    if (!re.test(haystack)) return false;
  }
  for (const label of c.roomKinds) {
    if (!roomKindMatcher(label).test(`${room.title} ${room.description || ''}`)) return false;
  }
  return true;
});

// (3) Kiểm tra quỹ phòng theo ngày + tính giá thực tế; lọc ngân sách theo giá thực tế
const applyAvailabilityAndBudget = async (candidates, c) => {
  const nights = c.checkIn ? Math.round((new Date(c.checkOut) - new Date(c.checkIn)) / DAY_MS) : 0;
  const roomsNeeded = c.rooms || 1;
  let inventoryByRoom = new Map();

  if (nights > 0 && candidates.length) {
    // Quỹ phòng lưu theo mốc 00:00 UTC từng ngày -> [checkIn, checkOut)
    const inventories = await RoomInventory.find({
      roomTypeId: { $in: candidates.map((x) => x.room._id) },
      date: { $gte: new Date(c.checkIn), $lt: new Date(c.checkOut) }
    }).lean();
    for (const inv of inventories) {
      const key = inv.roomTypeId.toString();
      if (!inventoryByRoom.has(key)) inventoryByRoom.set(key, []);
      inventoryByRoom.get(key).push(inv);
    }
  }

  const result = [];
  for (const item of candidates) {
    let pricePerNight = item.room.basePrice;
    let availableRooms = null; // null = khách chưa cho ngày, chưa kiểm tra được

    if (nights > 0) {
      const invs = inventoryByRoom.get(item.room._id.toString()) || [];
      if (invs.length < nights) continue; // chưa mở bán đủ các đêm
      availableRooms = Math.min(...invs.map((inv) => inv.availableRooms));
      if (availableRooms < roomsNeeded) continue; // hết phòng ít nhất 1 đêm
      pricePerNight = Math.round(invs.reduce((s, inv) => s + (inv.dynamicPrice || item.room.basePrice), 0) / nights);
    }

    if (c.maxPrice && pricePerNight > c.maxPrice) continue;
    if (c.minPrice && pricePerNight < c.minPrice) continue;
    result.push({ ...item, pricePerNight, availableRooms, nights });
  }
  return result;
};

// (4) Xếp hạng: giá (nếu khách hỏi rẻ nhất / đắt nhất) hoặc ngữ nghĩa + từ khóa
const rankCandidates = (candidates, { query, queryVector, constraints }) => {
  const scoreKeyword = buildKeywordScorer(candidates, query);
  const keywordScores = candidates.map((_, i) => scoreKeyword(i));
  const maxKeyword = Math.max(...keywordScores, 0) || 1;

  const scored = candidates.map((item, i) => {
    const semantic = queryVector ? cosine(queryVector, item.hotel.embedding) : 0;
    const keyword = keywordScores[i] / maxKeyword;
    const score = queryVector ? 0.7 * semantic + 0.3 * keyword : keyword;
    return { ...item, semanticScore: semantic, keywordScore: keyword, score };
  });

  if (constraints.sortByPrice) {
    const dir = constraints.sortByPrice === 'asc' ? 1 : -1;
    return scored.sort((a, b) => dir * (a.pricePerNight - b.pricePerNight) || b.score - a.score);
  }
  return scored.sort((a, b) => b.score - a.score);
};

// Pipeline đầy đủ: query -> constraints -> filter -> availability -> ranking
async function retrieveRooms({ query, constraints, queryVector = null, k = 5 }) {
  const catalog = await loadRoomCatalog({ withEmbedding: Boolean(queryVector) });
  const filtered = applyHardFilters(catalog, constraints);
  const available = await applyAvailabilityAndBudget(filtered, constraints);
  const ranked = rankCandidates(available, { query, queryVector, constraints }).slice(0, k);

  return {
    results: ranked,
    stats: { catalog: catalog.length, afterHardFilters: filtered.length, afterAvailability: available.length }
  };
}

// ---------------- Baseline cho benchmark ----------------

// Keyword search thuần (BM25 rút gọn) trên toàn bộ hạng phòng, không lọc ràng buộc
async function keywordSearch(query, k = 5, catalog = null) {
  const docs = catalog || await loadRoomCatalog();
  const score = buildKeywordScorer(docs, query);
  return docs.map((d, i) => ({ ...d, score: score(i) }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// Vector search thuần như phiên bản cũ: Atlas Search knnBeta trên embedding khách sạn (top-3 KS),
// rồi bung ra các hạng phòng của các khách sạn đó theo thứ tự khách sạn.
async function atlasVectorSearch(queryVector, kHotels = 3) {
  const hotels = await Hotel.aggregate([
    { $search: { index: 'default', knnBeta: { vector: queryVector, path: 'embedding', k: kHotels } } },
    { $match: { status: 'Approved' } },
    { $project: { embedding: 0 } }
  ]);
  const rooms = await RoomType.find({ hotelId: { $in: hotels.map((h) => h._id) }, isActive: { $ne: false } }).lean();
  const order = new Map(hotels.map((h, i) => [h._id.toString(), i]));
  return rooms
    .map((room) => ({ room, hotel: hotels[order.get(room.hotelId.toString())] }))
    .sort((a, b) => order.get(a.room.hotelId.toString()) - order.get(b.room.hotelId.toString()));
}

module.exports = {
  retrieveRooms, keywordSearch, atlasVectorSearch, loadRoomCatalog,
  applyHardFilters, applyAvailabilityAndBudget, rankCandidates, cosine, tokenize
};
