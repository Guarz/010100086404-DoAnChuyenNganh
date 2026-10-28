const mongoose = require('mongoose');

const ragLogSchema = new mongoose.Schema({
  userQuery: { type: String, required: true },
  
  // Danh sách ID các hạng phòng / khách sạn mà AI lấy ra được (dùng để tính Recall)
  retrievedContextIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' }],
  
  llmResponse: { type: String, required: true },
  
  // Dành cho Admin cập nhật thủ công (Ground Truth) để làm đáp án chuẩn
  goldenContextIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' }],

  // Chứa các chỉ số đánh giá (sẽ được tự động chấm hoặc admin tự chấm)
  metrics: {
    hitRate: { type: Number, default: null }, // 0 hoặc 1
    recall: { type: Number, default: null },
    precision: { type: Number, default: null },
    groundedness: { type: Number, default: null } // Điểm bám sát ngữ cảnh (0 - 10)
  },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RagLog', ragLogSchema);