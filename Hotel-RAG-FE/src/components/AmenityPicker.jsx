// File: src/components/AmenityPicker.jsx
// Chọn tiện nghi: bấm chip gợi ý để bật/tắt, hoặc gõ tiện nghi khác rồi Enter.
import { useState } from "react";

const sameText = (a, b) => a.trim().toLocaleLowerCase("vi") === b.trim().toLocaleLowerCase("vi");

export default function AmenityPicker({ value = [], onChange, suggestions = [], label = "Tiện nghi" }) {
  const [custom, setCustom] = useState("");

  const has = (item) => value.some((v) => sameText(v, item));
  const toggle = (item) =>
    onChange(has(item) ? value.filter((v) => !sameText(v, item)) : [...value, item]);

  const addCustom = () => {
    const item = custom.trim().replace(/\s+/g, " ");
    if (item && !has(item)) onChange([...value, item]);
    setCustom("");
  };

  // Tiện nghi đã chọn nhưng không nằm trong danh sách gợi ý
  const extras = value.filter((v) => !suggestions.some((s) => sameText(s, v)));

  return (
    <fieldset className="block">
      <legend className="text-sm font-bold text-stone-700">
        {label} <span className="font-normal text-stone-400">({value.length} đã chọn)</span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {[...suggestions, ...extras].map((item) => {
          const active = has(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-[#173b31] bg-[#173b31] text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
              }`}
            >
              {active ? "✓ " : "+ "}
              {item}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          maxLength={60}
          placeholder="Tiện nghi khác, nhấn Enter để thêm"
          className="min-w-0 flex-1 rounded-xl border border-stone-200 px-4 py-2.5 text-sm outline-none focus:border-[#173b31]"
        />
        <button
          type="button"
          onClick={addCustom}
          className="shrink-0 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700 hover:bg-stone-50"
        >
          Thêm
        </button>
      </div>
    </fieldset>
  );
}
