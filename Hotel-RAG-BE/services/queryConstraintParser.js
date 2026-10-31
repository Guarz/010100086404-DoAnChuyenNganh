// File: services/queryConstraintParser.js
// Bước 1 của pipeline RAG: tách RÀNG BUỘC CỨNG (hard constraints) ra khỏi câu hỏi tiếng Việt.
// Ràng buộc cứng được lọc bằng truy vấn có cấu trúc (MongoDB), phần còn lại (sở thích, phong cách,
// "view đẹp", "yên tĩnh"...) mới để cho Vector Search xếp hạng ngữ nghĩa.
//
// Dùng luật (rule-based) thay vì gọi LLM: kết quả tất định, kiểm thử được, không tốn quota,
// và vẫn hoạt động khi Gemini lỗi / hết hạn mức.

// Bỏ dấu tiếng Việt để so khớp không phụ thuộc cách gõ ("Đà Nẵng" ~ "da nang")
const plain = (text) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

const CITY_ALIASES = [
  ['Hà Nội', ['ha noi', 'hanoi', 'hn']],
  ['Hồ Chí Minh', ['ho chi minh', 'tp hcm', 'tphcm', 'hcm', 'sai gon', 'saigon']],
  ['Đà Nẵng', ['da nang', 'danang', 'my khe', 'son tra']],
  ['Đà Lạt', ['da lat', 'dalat']],
  ['Phú Quốc', ['phu quoc']],
  ['Nha Trang', ['nha trang']],
  ['Hội An', ['hoi an']],
  ['Huế', ['hue']]
];

// Tiện nghi bắt buộc: từ khóa (không dấu) -> nhãn hiển thị + regex khớp dữ liệu (có dấu)
const AMENITIES = [
  { label: 'Hồ bơi', keys: ['ho boi', 'be boi', 'pool'], match: /hồ bơi|bể bơi|pool/i },
  { label: 'Bồn tắm', keys: ['bon tam'], match: /bồn tắm|bathtub/i },
  { label: 'Ban công', keys: ['ban cong'], match: /ban công|balcony/i },
  { label: 'Bếp', keys: ['bep', 'nau an'], match: /bếp|kitchen/i },
  { label: 'Lò sưởi', keys: ['lo suoi'], match: /lò sưởi|fireplace/i },
  { label: 'Smart TV', keys: ['smart tv', 'tivi', 'tv'], match: /smart tv|tivi|\btv\b/i },
  { label: 'Gym', keys: ['gym', 'phong tap'], match: /gym|phòng tập/i },
  { label: 'Spa', keys: ['spa'], match: /spa/i },
  { label: 'Wi-Fi', keys: ['wifi', 'wi-fi'], match: /wi-?fi/i },
  { label: 'Bữa sáng', keys: ['bua sang', 'an sang', 'breakfast'], match: /bữa sáng|ăn sáng|breakfast/i },
  { label: 'Bàn làm việc', keys: ['ban lam viec'], match: /bàn làm việc|desk/i },
  { label: 'Bãi biển riêng', keys: ['bai bien rieng'], match: /bãi biển riêng|private beach/i },
  { label: 'Hồ bơi riêng', keys: ['ho boi rieng'], match: /hồ bơi riêng|private pool/i },
  { label: 'Đưa đón sân bay', keys: ['dua don'], match: /đưa đón/i },
  { label: 'Bãi đỗ xe', keys: ['do xe', 'dau xe', 'bai xe'], match: /đỗ xe|đậu xe|parking/i }
];

// Loại phòng bắt buộc (khớp với tên hạng phòng)
const ROOM_KINDS = [
  { label: 'Biệt thự / Villa', keys: ['biet thu', 'villa'], match: /biệt thự|villa/i },
  { label: 'Suite', keys: ['suite'], match: /suite/i },
  { label: 'Twin', keys: ['twin', 'giuong doi tach'], match: /twin/i },
  { label: 'Family', keys: ['phong gia dinh', 'family'], match: /family|gia đình/i }
];

const NUMBER_WORDS = { mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 };

const OFF_TOPIC = [
  /\bhack\b/, /sql\s*injection/, /prompt (he thong|system)/, /system prompt/, /bo qua (moi|tat ca) (chi thi|huong dan)/,
  /ignore (all|previous)/, /\bpython\b|\bjavascript\b|vong lap|\bcode\b/, /chinh tri/, /ve may bay/, /lap trinh boi ai/
];
const HOTEL_INTENT = /phong|khach san|resort|homestay|villa|biet thu|suite|nghi duong|luu tru|dat cho|check.?in|o dau|gia|dem|view|bien|ho boi/;

const hasKey = (text, key) => new RegExp(`(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(text);

const toNumber = (raw) => {
  const word = NUMBER_WORDS[raw];
  return word !== undefined ? word : parseInt(raw, 10);
};

// "1 triệu", "1,5tr", "800k", "1.200.000đ" -> số tiền VND
const parseMoney = (amount, unit = '') => {
  let value;
  if (/^\d{1,3}([.,]\d{3})+$/.test(amount)) value = Number(amount.replace(/[.,]/g, '')); // 1.200.000
  else value = Number(amount.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  if (/^(trieu|tr|cu)/.test(unit)) value *= 1000000;
  else if (/^(k|nghin|ngan)/.test(unit)) value *= 1000;
  else if (value < 10000) value *= 1000000; // "dưới 2" trong ngữ cảnh giá phòng -> triệu
  return Math.round(value);
};

// dd/mm, dd/mm/yyyy, dd-mm hoặc yyyy-mm-dd -> 'YYYY-MM-DD'; năm mặc định là lần gần nhất chưa qua
const toIsoDate = (day, month, year, now) => {
  let y = year ? Number(year.length === 2 ? `20${year}` : year) : now.getFullYear();
  const candidate = new Date(Date.UTC(y, month - 1, day));
  if (candidate.getUTCMonth() !== month - 1) return null;
  if (!year && candidate < new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))) y += 1;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function parseQueryConstraints(query, now = new Date()) {
  const text = plain(String(query || '')).replace(/\s+/g, ' ').trim();
  const c = {
    city: null, checkIn: null, checkOut: null, adults: null, children: null, rooms: null,
    minPrice: null, maxPrice: null, amenities: [], roomKinds: [], sortByPrice: null,
    offTopic: false, isHotelQuery: false
  };

  c.offTopic = OFF_TOPIC.some((re) => re.test(text));

  for (const [city, aliases] of CITY_ALIASES) {
    if (aliases.some((alias) => hasKey(text, alias))) { c.city = city; break; }
  }

  // Số khách
  const num = '(\\d+|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)';
  const adults = text.match(new RegExp(`${num} (nguoi lon|nguoi|khach)`));
  if (adults) c.adults = toNumber(adults[1]);
  const children = text.match(new RegExp(`${num} (tre em|tre nho|tre|be|chau)`));
  if (children) c.children = toNumber(children[1]);
  const rooms = text.match(new RegExp(`${num} phong(?! (ngu|khach|tap))`));
  if (rooms && /dat|can|lay|muon/.test(text)) c.rooms = toNumber(rooms[1]);

  // Ngân sách
  // Số tiền phải có đơn vị (triệu/k/đ...), riêng "dưới/tối đa/không quá N" cho phép thiếu đơn vị
  // nhưng không được theo sau bởi người/đêm/phòng/sao (tránh nhầm "dưới 3 người").
  const unit = '(trieu|tr|cu|k|nghin|ngan|d|dong|vnd)';
  const amount = '(\\d+(?:[.,]\\d+)*)';
  const notCount = '(?! ?(nguoi|khach|dem|ngay|phong|sao|tre|be))';
  const range = text.match(new RegExp(`tu ${amount}\\s*${unit}? (?:den|toi|-) ${amount}\\s*${unit}`));
  const max = text.match(new RegExp(`(?:duoi|toi da|khong qua|it hon|re hon|<=?) ${amount}\\s*${unit}?${notCount}`)) ||
    text.match(new RegExp(`(?:tam|khoang|max|gia) ${amount}\\s*${unit}`));
  const min = text.match(new RegExp(`(?:tren|it nhat|toi thieu|>=?) ${amount}\\s*${unit}`));
  if (range) {
    c.minPrice = parseMoney(range[1], range[2] || range[4]);
    c.maxPrice = parseMoney(range[3], range[4]);
  } else {
    if (max) c.maxPrice = parseMoney(max[1], max[2]);
    if (min) c.minPrice = parseMoney(min[1], min[2]);
  }
  if (/re nhat|gia re|binh dan|tiet kiem/.test(text)) c.sortByPrice = 'asc';
  if (/dat nhat|cao cap nhat|sang nhat/.test(text)) c.sortByPrice = 'desc';

  // Ngày ở
  const dateRe = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/g;
  const dates = [];
  for (const m of text.matchAll(dateRe)) {
    const iso = m[1] ? toIsoDate(Number(m[3]), Number(m[2]), m[1], now) : toIsoDate(Number(m[4]), Number(m[5]), m[6], now);
    if (iso) dates.push(iso);
  }
  const nights = text.match(new RegExp(`${num} (dem|ngay)`));
  if (dates[0]) {
    c.checkIn = dates[0];
    c.checkOut = dates[1] && dates[1] > dates[0] ? dates[1] : addDays(dates[0], nights ? toNumber(nights[1]) : 1);
  }

  for (const a of AMENITIES) if (a.keys.some((k) => hasKey(text, k))) c.amenities.push(a.label);
  // "hồ bơi riêng" bao hàm "hồ bơi"
  if (c.amenities.includes('Hồ bơi riêng')) c.amenities = c.amenities.filter((a) => a !== 'Hồ bơi');
  for (const k of ROOM_KINDS) if (k.keys.some((key) => hasKey(text, key))) c.roomKinds.push(k.label);

  c.isHotelQuery = !c.offTopic && (
    HOTEL_INTENT.test(text) || Boolean(c.city || c.checkIn || c.adults || c.maxPrice || c.amenities.length || c.roomKinds.length)
  );
  return c;
}

const hasHardConstraints = (c) => Boolean(
  c.city || c.checkIn || c.adults || c.children || c.rooms || c.minPrice || c.maxPrice ||
  c.amenities.length || c.roomKinds.length
);

const amenityMatcher = (label) => AMENITIES.find((a) => a.label === label).match;
const roomKindMatcher = (label) => ROOM_KINDS.find((k) => k.label === label).match;

module.exports = { parseQueryConstraints, hasHardConstraints, amenityMatcher, roomKindMatcher, plain };
