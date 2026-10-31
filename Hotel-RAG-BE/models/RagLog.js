const mongoose = require('mongoose');

const ragLogSchema = new mongoose.Schema({
  userQuery: { type: String, required: true },

  // Ràng buộc cứng tách được từ câu hỏi (services/queryConstraintParser.js)
  constraints: { type: mongoose.Schema.Types.Mixed },

  // Khách sạn chứa các hạng phòng được truy xuất
  retrievedHotelIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }],

  // Hạng phòng được truy xuất, THEO THỨ TỰ XẾP HẠNG - cùng cấp với golden_dataset.json
  // (dùng tính HitRate / Recall@K / Precision@K / nDCG@K)
  retrievedContextIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' }],

  llmResponse: { type: String, required: true },
  // llm: Gemini sinh câu trả lời | template: LLM lỗi, dùng câu trả lời dựng từ dữ liệu | guardrail: từ chối câu hỏi ngoài phạm vi
  answerSource: { type: String, enum: ['llm', 'template', 'guardrail'] },
  // Model đã sinh câu trả lời, dạng "<provider>:<model>", vd. "ollama:dolphin3", "gemini:gemini-3.8-flash"
  llmModel: { type: String },
  // Số ứng viên sau từng bước lọc: catalog -> afterHardFilters -> afterAvailability
  pipelineStats: { type: mongoose.Schema.Types.Mixed },
  latencyMs: { type: Number },

  // Dành cho Admin cập nhật thủ công (Ground Truth) để làm đáp án chuẩn
  goldenContextIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' }],

  // Chứa các chỉ số đánh giá (sẽ được tự động chấm hoặc admin tự chấm)
  metrics: {
    hitRate: { type: Number, default: null }, // 0 hoặc 1
    recall: { type: Number, default: null },
    precision: { type: Number, default: null },
    groundedness: { type: Number, default: null }, // 1 = bám sát ngữ cảnh, 0 = có bịa (LLM-as-judge)
    citationCorrectness: { type: Number, default: null } // Tỉ lệ trích dẫn [n] hợp lệ trong câu trả lời
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RagLog', ragLogSchema);
