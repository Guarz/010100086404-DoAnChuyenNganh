// File: constants/provinces.js
// Danh mục CỐ ĐỊNH 63 tỉnh/thành phố Việt Nam (58 tỉnh + 5 thành phố trực thuộc TW), sắp xếp A→Z.
// Mọi trường "Tỉnh/TP" (khách sạn, hồ sơ người dùng, nhà xe, tuyến xe) chỉ nhận giá trị trong danh sách này.
// Bản giống hệt cho frontend: Hotel-RAG-FE/src/constants/provinces.js (test kiểm tra 2 bản khớp nhau).

const PROVINCE_NAMES = [
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bạc Liêu', 'Bắc Giang', 'Bắc Kạn', 'Bắc Ninh', 'Bến Tre', 'Bình Dương',
  'Bình Định', 'Bình Phước', 'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Cần Thơ', 'Đà Nẵng', 'Đắk Lắk', 'Đắk Nông',
  'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Nội', 'Hà Tĩnh', 'Hải Dương',
  'Hải Phòng', 'Hậu Giang', 'Hòa Bình', 'Hồ Chí Minh', 'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum',
  'Lai Châu', 'Lạng Sơn', 'Lào Cai', 'Lâm Đồng', 'Long An', 'Nam Định', 'Nghệ An', 'Ninh Bình', 'Ninh Thuận',
  'Phú Thọ', 'Phú Yên', 'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng',
  'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh',
  'Tuyên Quang', 'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái'
];

// Sắp xếp theo bảng chữ cái tiếng Việt (Đ đứng sau D, ...)
const VN_PROVINCES = Object.freeze([...PROVINCE_NAMES].sort((a, b) => a.localeCompare(b, 'vi')));

// Bỏ dấu, chữ thường, gộp khoảng trắng, bỏ tiền tố "tỉnh / thành phố / tp."
const fold = (value) => String(value || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd')
  .toLowerCase().replace(/[-–.,]/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/^(tinh|thanh pho|tp)\s+/, '');

// Cách viết khác / địa danh nổi tiếng -> tỉnh/thành chuẩn
const ALIASES = {
  'hcm': 'Hồ Chí Minh', 'tphcm': 'Hồ Chí Minh', 'tp hcm': 'Hồ Chí Minh', 'sai gon': 'Hồ Chí Minh', 'saigon': 'Hồ Chí Minh',
  'hn': 'Hà Nội', 'hanoi': 'Hà Nội', 'danang': 'Đà Nẵng',
  'hue': 'Thừa Thiên Huế', 'thua thien hue': 'Thừa Thiên Huế',
  'ba ria vung tau': 'Bà Rịa - Vũng Tàu', 'vung tau': 'Bà Rịa - Vũng Tàu', 'brvt': 'Bà Rịa - Vũng Tàu',
  'da lat': 'Lâm Đồng', 'dalat': 'Lâm Đồng', 'nha trang': 'Khánh Hòa', 'cam ranh': 'Khánh Hòa',
  'phu quoc': 'Kiên Giang', 'ha tien': 'Kiên Giang', 'hoi an': 'Quảng Nam', 'sa pa': 'Lào Cai', 'sapa': 'Lào Cai',
  'ha long': 'Quảng Ninh', 'quy nhon': 'Bình Định', 'phan thiet': 'Bình Thuận', 'mui ne': 'Bình Thuận',
  'buon ma thuot': 'Đắk Lắk', 'dak lak': 'Đắk Lắk', 'dac lac': 'Đắk Lắk', 'dak nong': 'Đắk Nông',
  'tam dao': 'Vĩnh Phúc', 'con dao': 'Bà Rịa - Vũng Tàu', 'phong nha': 'Quảng Bình', 'dong hoi': 'Quảng Bình',
  'trang an': 'Ninh Bình', 'mai chau': 'Hòa Bình', 'moc chau': 'Sơn La', 'tuy hoa': 'Phú Yên', 'pleiku': 'Gia Lai',
  'hoa binh': 'Hòa Bình', 'khanh hoa': 'Khánh Hòa', 'thanh hoa': 'Thanh Hóa'
};

const LOOKUP = new Map([
  ...VN_PROVINCES.map((p) => [fold(p), p]),
  ...Object.entries(ALIASES)
]);

// Chuẩn hóa chuỗi người dùng nhập (có/không dấu, tên địa danh) -> tên tỉnh chuẩn, không khớp -> null
const normalizeProvince = (value) => (typeof value === 'string' && value.trim() ? LOOKUP.get(fold(value)) || null : null);

const isProvince = (value) => VN_PROVINCES.includes(value);

// Kiểu Mongoose cho trường tỉnh/thành: tự chuẩn hóa cách viết khác ("Huế" -> "Thừa Thiên Huế"),
// giá trị ngoài danh mục 63 tỉnh bị từ chối khi lưu.
const provinceSchemaType = ({ required = false } = {}) => ({
  type: String,
  required,
  set: (value) => (value === '' || value == null ? value : normalizeProvince(value) || value),
  validate: {
    validator: (value) => (value === '' || value == null ? !required : isProvince(value)),
    message: (props) => `"${props.value}" không thuộc danh mục 63 tỉnh/thành phố`
  }
});

module.exports = { VN_PROVINCES, normalizeProvince, isProvince, provinceSchemaType, foldVietnamese: fold };
