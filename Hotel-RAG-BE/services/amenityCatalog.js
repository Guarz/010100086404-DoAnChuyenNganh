// File: services/amenityCatalog.js
// Danh mục tiện nghi CHUẨN dùng cho bộ lọc trang danh sách khách sạn.
// Dữ liệu tiện nghi do Partner nhập tự do ("Wifi miễn phí", "WiFi", "Wi-Fi"...), nên mỗi mục chuẩn
// có một regex để khớp mọi cách viết. Dùng chung danh sách với bộ tách ràng buộc của trợ lý RAG,
// thêm vài mục chỉ dùng để lọc.
const { AMENITIES } = require('./queryConstraintParser');

const FILTER_ONLY = [
  { label: 'Nhà hàng', match: /nhà hàng|restaurant|buffet/i },
  { label: 'Gần biển', match: /gần biển|hướng biển|view biển|nhìn ra biển|sát biển|bãi biển/i },
  { label: 'Quầy bar', match: /quầy bar|\bbar\b/i },
  { label: 'Minibar', match: /minibar/i },
  { label: 'Điều hòa', match: /điều hòa|máy lạnh/i }
];

const CATALOG = [...AMENITIES.map(({ label, match }) => ({ label, match })), ...FILTER_ONLY];

const MAX_AMENITIES = 30;
const MAX_AMENITY_LENGTH = 60;
const MAX_IMAGES = 20;

// Văn bản dùng để khớp tiện nghi của 1 khách sạn: tiện nghi KS + tiện nghi và tên các hạng phòng đang bán
const amenityHaystack = (hotel, rooms = []) => [
  ...(hotel.amenities || []),
  ...rooms.flatMap((room) => [room.title, ...(room.amenities || [])])
].join(' | ');

const catalogEntry = (label) => CATALOG.find((item) => item.label === label);

// Khách sạn có đủ TẤT CẢ tiện nghi được chọn không
const hasAllAmenities = (haystack, labels) =>
  labels.every((label) => catalogEntry(label)?.match.test(haystack));

// Chuẩn hóa danh sách tiện nghi Partner gửi lên: chuỗi, bỏ khoảng trắng, bỏ trùng (không phân biệt hoa thường)
const sanitizeAmenities = (input) => {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) throw new Error('Tiện nghi phải là một danh sách');
  const seen = new Set();
  const result = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim().replace(/\s+/g, ' ');
    if (!value) continue;
    if (value.length > MAX_AMENITY_LENGTH) throw new Error(`Mỗi tiện nghi tối đa ${MAX_AMENITY_LENGTH} ký tự`);
    const key = value.toLocaleLowerCase('vi');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  if (result.length > MAX_AMENITIES) throw new Error(`Tối đa ${MAX_AMENITIES} tiện nghi`);
  return result;
};

// Chỉ nhận URL ảnh http(s), bỏ trùng
const sanitizeImages = (input) => {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) throw new Error('Ảnh phải là một danh sách URL');
  const urls = [...new Set(input.filter((u) => typeof u === 'string').map((u) => u.trim()).filter(Boolean))];
  for (const url of urls) {
    let parsed;
    try { parsed = new URL(url); } catch { parsed = null; }
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) throw new Error(`URL ảnh không hợp lệ: ${url.slice(0, 80)}`);
  }
  if (urls.length > MAX_IMAGES) throw new Error(`Tối đa ${MAX_IMAGES} ảnh`);
  return urls;
};

module.exports = { CATALOG, amenityHaystack, hasAllAmenities, sanitizeAmenities, sanitizeImages, catalogEntry };
