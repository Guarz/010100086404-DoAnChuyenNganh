// File: src/components/ProvinceSelect.jsx
// Ô chọn Tỉnh/TP từ danh mục cố định 63 tỉnh thành (A→Z) - thay cho ô nhập tay.
//  - counts: { "Đà Nẵng": 8, ... } -> hiện "(8)" sau tên, dùng cho bộ lọc khách sạn / xe
//  - options: giới hạn danh sách (vd. chỉ các tỉnh nhà xe đã đăng ký)
//  - placeholder: dòng đầu rỗng ("Tất cả tỉnh/thành" cho bộ lọc, "Chọn Tỉnh/TP" cho form)
import { VN_PROVINCES } from "../constants/provinces";

export default function ProvinceSelect({
  value,
  onChange,
  counts,
  countUnit = "",
  options = VN_PROVINCES,
  placeholder = "Chọn Tỉnh/TP",
  allowEmpty = true,
  className = "",
  ...props
}) {
  // Giá trị cũ không nằm trong danh mục (dữ liệu trước khi chuẩn hóa) vẫn hiện để người dùng thấy và chọn lại
  const legacy = value && !options.includes(value) ? value : null;
  return (
    <select value={value || ""} onChange={onChange} className={className} {...props}>
      {allowEmpty && <option value="">{placeholder}</option>}
      {legacy && (
        <option value={legacy} disabled>
          {legacy} (không hợp lệ - chọn lại)
        </option>
      )}
      {options.map((name) => {
        const n = counts?.[name];
        return (
          <option key={name} value={name}>
            {n ? `${name} (${n}${countUnit})` : name}
          </option>
        );
      })}
    </select>
  );
}
