// File: src/components/StatCard.jsx
import Icon from "./Icon"; // Sửa thành "./Icon" nếu Icon.jsx nằm chung thư mục components

export default function StatCard({ icon, label, value, note }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-500">{label}</p>
          <p className="mt-3 font-display text-4xl font-semibold text-[#173b31]">{value}</p>
        </div>
        <span className="grid size-10 place-items-center rounded-xl bg-[#f1eee6] text-[#b7812d]">
          <Icon name={icon} />
        </span>
      </div>
      <p className="mt-4 text-xs font-semibold text-emerald-700">{note}</p>
    </div>
  );
}