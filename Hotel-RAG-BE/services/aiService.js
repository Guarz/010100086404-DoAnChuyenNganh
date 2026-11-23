// File: services/aiService.js
// Tạo vector (embedding) cho khách sạn bằng model Ollama (mặc định bge-m3) - xem services/llmService.js.
// Gọi khi Admin duyệt khách sạn và khi Partner sửa nội dung ảnh hưởng tìm kiếm.
const { embedText } = require('./llmService');

// Nội dung đem đi tạo vector: tên, mô tả, tiện ích, địa chỉ
const hotelEmbeddingText = (hotelData) =>
  `Khách sạn: ${hotelData.hotelName}. Mô tả: ${hotelData.description || ''}. ` +
  `Tiện ích: ${(hotelData.amenities || []).join(', ')}. ` +
  `Vị trí: ${hotelData.address?.street || ''}, ${hotelData.address?.city || ''}, ${hotelData.address?.province || ''}.`;

// Trả về [] khi lỗi (Ollama chưa chạy / quá thời gian) thay vì throw, để luồng duyệt vẫn chạy
exports.generateHotelEmbedding = async (hotelData) => {
  try {
    return await embedText(hotelEmbeddingText(hotelData));
  } catch (error) {
    console.error('Không tạo được vector khách sạn (Ollama):', error.message);
    return [];
  }
};

exports.hotelEmbeddingText = hotelEmbeddingText;
