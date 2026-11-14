// File: src/components/ProvinceMultiSelect.jsx
// Chọn NHIỀU tỉnh/thành từ danh mục 63 tỉnh (dùng cho "Tỉnh/thành phục vụ" của nhà xe).
// Chọn trong danh sách để thêm, bấm ✕ trên thẻ để bỏ.
import ProvinceSelect from "./ProvinceSelect";
import { VN_PROVINCES } from "../constants/provinces";

export default function ProvinceMultiSelect({ value = [], onChange, className = "" }) {
  const remaining = VN_PROVINCES.filter((p) => !value.includes(p));
  // Giữ thứ tự A→Z giống danh mục
  const add = (name) => name && onChange(VN_PROVINCES.filter((p) => p === name || value.includes(p)));
  const remove = (name) => onChange(value.filter((p) => p !== name));

  return (
    <div>
      <ProvinceSelect
        value=""
        options={remaining}
        placeholder={value.length ? "+ Thêm tỉnh/thành" : "Chọn tỉnh/thành"}
        onChange={(e) => add(e.target.value)}
        className={className}
        aria-label="Thêm tỉnh/thành phục vụ"
      />
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((p) => (
            <span key={p} className="inline-flex items-center gap-1 rounded-full bg-[#e8f2ed] py-1 pl-3 pr-1 text-sm font-semibold text-[#173b31]">
              {p}
              <button
                type="button"
                onClick={() => remove(p)}
                aria-label={`Bỏ ${p}`}
                className="grid size-6 place-items-center rounded-full text-xs hover:bg-white"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
