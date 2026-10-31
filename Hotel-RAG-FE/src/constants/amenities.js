// File: src/constants/amenities.js
// Gợi ý tiện nghi cho Partner khi tạo / sửa. Dùng đúng cách viết này thì bộ lọc ở trang danh sách
// và trợ lý AI nhận diện được (xem Hotel-RAG-BE/services/amenityCatalog.js). Partner vẫn có thể tự thêm.
export const HOTEL_AMENITY_SUGGESTIONS = [
  "Wifi miễn phí", "Hồ bơi", "Spa", "Phòng gym", "Nhà hàng", "Quầy bar", "Bữa sáng",
  "Bãi đỗ xe", "Đưa đón sân bay", "Bãi biển riêng", "Gần biển", "Lễ tân 24/7",
];

export const ROOM_AMENITY_SUGGESTIONS = [
  "Wifi miễn phí", "Điều hòa", "Smart TV", "Ban công", "Bồn tắm", "Minibar",
  "Bàn làm việc", "Bếp", "Lò sưởi", "Hồ bơi riêng", "Két sắt", "Máy sấy tóc",
];
