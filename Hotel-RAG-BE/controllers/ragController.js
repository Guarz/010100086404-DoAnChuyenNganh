const RagLog = require('../models/RagLog');

exports.handleAIChat = async (req, res) => {
  try {
    const { query } = req.body;

    // 1. Vector Search tìm chunk/tài liệu
    const retrievedDocs = await performVectorSearch(query); 

    // 2. Gọi Gemini / GPT
    const llmAnswer = await callLLM(query, retrievedDocs);

    // 3. Phản hồi cho khách hàng NGAY LẬP TỨC
    res.status(200).json({ success: true, answer: llmAnswer });

    // 4. LƯU LOG NGẦM VÀO MONGODB (Không có await)
    RagLog.create({
      userQuery: query,
      retrievedContextIds: retrievedDocs.map(doc => doc._id),
      llmResponse: llmAnswer
    }).catch(err => console.error(" Lỗi lưu RagLog vào DB:", err));

  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};