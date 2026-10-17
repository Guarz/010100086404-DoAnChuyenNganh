const Hotel = require('../models/Hotel');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

exports.searchHotelsWithAI = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi tìm kiếm' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ Không tìm thấy API Key trong file .env!");
        return res.status(500).json({ success: false, message: 'Lỗi cấu hình hệ thống AI' });
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);

    // BƯỚC 1: Dịch câu hỏi thành Vector (Dùng chung model với aiService)
    console.log("Đang dịch câu hỏi thành Vector...");
    const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const embedResult = await embedModel.embedContent(query);
    const queryVector = embedResult.embedding.values;

    // BƯỚC 2: Tìm kiếm dưới Database
    console.log("Đang tìm kiếm dưới Database...");
    const searchResults = await Hotel.aggregate([
      {
        $search: {
          index: "default", 
          knnBeta: {
            vector: queryVector,
            path: "embedding",
            k: 3
          }
        }
      },
      { $match: { status: 'Approved' } },
      { $project: { embedding: 0 } }
    ]);

    if (searchResults.length === 0) {
      return res.json({ success: true, answer: "Xin lỗi, hiện không có khách sạn nào phù hợp với yêu cầu của bạn.", data: [] });
    }

    // BƯỚC 3: Nhờ AI viết tư vấn (Dùng model viết văn)
    console.log("Đang nhờ AI sinh câu trả lời...");
    const prompt = `
      Bạn là nhân viên tư vấn OTA (đặt phòng). Khách hàng vừa hỏi: "${query}".
      Hệ thống vừa tìm được ${searchResults.length} khách sạn phù hợp nhất dưới đây (Dữ liệu JSON):
      ${JSON.stringify(searchResults)}
      
      Nhiệm vụ: Dựa vào thông tin trên, hãy viết một đoạn tư vấn ngắn gọn, thân thiện (khoảng 3-4 câu) bằng tiếng Việt để giới thiệu các khách sạn này cho khách.
    `;

    // BẮT BUỘC: Sử dụng gemini-pro để sinh văn bản (Hỗ trợ 100%)
    const chatModel = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
    const chatResult = await chatModel.generateContent(prompt);

    res.status(200).json({
      success: true,
      answer: chatResult.response.text(),
      data: searchResults 
    });

  } catch (error) {
    console.error("❌ Lỗi AI Search:", error);
    res.status(500).json({ success: false, message: 'Lỗi khi tìm kiếm AI' });
  }
};