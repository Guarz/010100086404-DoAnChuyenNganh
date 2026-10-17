const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); 

exports.generateHotelEmbedding = async (hotelData) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ Không tìm thấy API Key!");
        return [];
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // BẮT BUỘC: Chỉ dùng model embedding ở đây
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    const textToEmbed = `Khách sạn: ${hotelData.hotelName}. Mô tả: ${hotelData.description}. Tiện ích: ${hotelData.amenities.join(', ')}. Vị trí: ${hotelData.address.street}, ${hotelData.address.city}, ${hotelData.address.province}.`;

    // Dịch ra mảng 3072 số
    const result = await model.embedContent(textToEmbed); 
    
    return result.embedding.values; 
    
  } catch (error) {
    console.error("❌ Lỗi khi gọi API tạo Embedding:", error);
    return [];
  }
};