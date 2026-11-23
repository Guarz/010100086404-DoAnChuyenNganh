// File: src/hooks/useWishlist.js
// Danh sách khách sạn yêu thích dùng chung cho mọi trang (thẻ khách sạn, trang chi tiết, trang Tài khoản):
// một kho nhỏ ngoài React + useSyncExternalStore, nên bấm trái tim ở đâu thì mọi nơi cập nhật theo.
import { useEffect, useSyncExternalStore } from "react";
import API from "../services/api";

let ids = new Set();
let loadedFor = null; // token đã tải danh sách (đổi tài khoản thì tải lại)
let loading = null;
const listeners = new Set();
const emit = () => {
  ids = new Set(ids); // đối tượng mới để React nhận ra thay đổi
  listeners.forEach((l) => l());
};

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => ids;

const load = () => {
  const token = localStorage.getItem("nestly_token");
  if (!token) {
    if (ids.size) { ids = new Set(); emit(); }
    loadedFor = null;
    return Promise.resolve();
  }
  if (loadedFor === token) return loading || Promise.resolve();
  loadedFor = token;
  loading = API.get("/users/me/wishlist")
    .then((r) => { ids = new Set((r.data.ids || []).map(String)); emit(); })
    .catch(() => { loadedFor = null; })
    .finally(() => { loading = null; });
  return loading;
};

// Bật/tắt yêu thích. Cập nhật giao diện ngay rồi gọi API; lỗi thì hoàn tác.
export const toggleWishlist = async (hotelId) => {
  const id = String(hotelId);
  const had = ids.has(id);
  if (had) ids.delete(id); else ids.add(id);
  emit();
  try {
    if (had) await API.delete(`/users/me/wishlist/${id}`);
    else await API.post(`/users/me/wishlist/${id}`);
    return !had;
  } catch (error) {
    if (had) ids.add(id); else ids.delete(id);
    emit();
    throw error;
  }
};

export const reloadWishlist = () => { loadedFor = null; return load(); };

export default function useWishlist() {
  const current = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => { load(); }, []);
  return current;
}
