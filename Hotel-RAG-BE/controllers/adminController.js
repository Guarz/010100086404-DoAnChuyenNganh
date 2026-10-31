// File: controllers/adminController.js
const Hotel = require('../models/Hotel');
const User = require('../models/User');
const RagLog = require('../models/RagLog');
const RoomType = require('../models/RoomType');
const mongoose = require('mongoose');
const { generateHotelEmbedding } = require('../services/aiService');
const { evaluateQuery, summarize, citationCorrectness } = require('../services/ragMetrics');
const { generateText } = require('../services/llmService');

// [GET] /api/admin/users - Lấy danh sách người dùng
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('fullName email phone role status partnerApplicationStatus createdAt')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách người dùng:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách người dùng lúc này' });
  }
};

// [PUT] /api/admin/users/:userId/status - Khóa hoặc mở khóa tài khoản
exports.updateUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ success: false, message: 'Mã người dùng không hợp lệ' });
  }

  if (!['Active', 'Locked'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái tài khoản không hợp lệ' });
  }

  if (userId.toLowerCase() === req.user.id.toLowerCase()) {
    return res.status(400).json({ success: false, message: 'Bạn không thể thay đổi trạng thái tài khoản đang đăng nhập' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { returnDocument: 'after', runValidators: true }
    ).select('fullName email phone role status partnerApplicationStatus createdAt');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    return res.status(200).json({
      success: true,
      message: status === 'Locked' ? 'Đã khóa tài khoản người dùng' : 'Đã mở khóa tài khoản người dùng',
      data: user
    });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái người dùng:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái tài khoản lúc này' });
  }
};

// [GET] /api/admin/hotels/pending - Lấy danh sách khách sạn đang chờ duyệt
exports.getPendingHotels = async (req, res) => {
  try {
    const pendingHotels = await Hotel.find({ status: 'Pending' })
                                     .select('-embedding'); // Ẩn vector cho nhẹ
    
    res.status(200).json({
      success: true,
      count: pendingHotels.length,
      data: pendingHotels
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách chờ duyệt:", error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// [GET] /api/admin/hotels?status=Pending|Approved|Rejected|all - Danh sách toàn bộ khách sạn
exports.getHotels = async (req, res) => {
  const { status = 'all' } = req.query;
  const allowed = ['Pending', 'Approved', 'Rejected', 'all'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái lọc không hợp lệ' });
  }

  try {
    const filter = status === 'all' ? {} : { status };
    const [hotels, counts] = await Promise.all([
      Hotel.find(filter)
        .select('-embedding')
        .populate('partnerId', 'fullName email phone')
        // Hồ sơ chờ duyệt: cũ nhất lên đầu. Còn lại: mới nhất lên đầu
        .sort({ createdAt: status === 'Pending' ? 1 : -1 }),
      Hotel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);

    const summary = { Pending: 0, Approved: 0, Rejected: 0, all: 0 };
    counts.forEach(({ _id, count }) => {
      summary[_id] = count;
      summary.all += count;
    });

    return res.status(200).json({ success: true, count: hotels.length, summary, data: hotels });
  } catch (error) {
    console.error('Lỗi lấy danh sách khách sạn:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách khách sạn lúc này' });
  }
};

// [PUT] /api/admin/hotels/:id/status - Duyệt (Approved) hoặc Từ chối (Rejected) khách sạn
// Body: { status: 'Approved' | 'Rejected', reason?: string }
exports.updateHotelStatus = async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Mã khách sạn không hợp lệ' });
  }

  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái chỉ được là Approved hoặc Rejected' });
  }

  try {
    const hotel = await Hotel.findById(id);
    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách sạn' });
    }

    if (hotel.status === status) {
      return res.status(409).json({ success: false, message: 'Khách sạn đã ở trạng thái này' });
    }

    let message;
    if (status === 'Approved') {
      hotel.rejectionReason = undefined;

      // Tạo Vector Embedding cho RAG. Nếu AI lỗi thì vẫn duyệt, chỉ cảnh báo để Admin biết.
      // (generateHotelEmbedding trả về [] khi Gemini lỗi thay vì throw)
      console.log('Đang tạo Vector Embedding cho khách sạn...');
      const embedding = await generateHotelEmbedding(hotel).catch((aiError) => {
        console.error('Lỗi tạo embedding khi duyệt khách sạn:', aiError);
        return [];
      });
      hotel.embedding = embedding;
      message = embedding.length > 0
        ? `Đã duyệt "${hotel.hotelName}" và tạo Vector AI thành công!`
        : `Đã duyệt "${hotel.hotelName}" nhưng chưa tạo được Vector AI (khách sạn tạm thời chưa xuất hiện trong gợi ý AI).`;
    } else {
      hotel.rejectionReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : undefined;
      message = `Đã từ chối khách sạn "${hotel.hotelName}"`;
    }

    hotel.status = status;
    hotel.reviewedAt = new Date();
    await hotel.save();

    const data = hotel.toObject();
    delete data.embedding;
    await Hotel.populate(data, { path: 'partnerId', select: 'fullName email phone' });

    return res.status(200).json({ success: true, message, data });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái khách sạn:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái khách sạn lúc này' });
  }
};

// [PUT] /api/admin/hotels/:id/approve - Giữ lại để tương thích với code cũ
exports.approveHotel = (req, res) => {
  req.body = { ...req.body, status: 'Approved' };
  return exports.updateHotelStatus(req, res);
};

// [PUT] /api/admin/hotels/:id/reject
exports.rejectHotel = (req, res) => {
  req.body = { ...req.body, status: 'Rejected' };
  return exports.updateHotelStatus(req, res);
};

exports.evaluateGroundedness = async (req, res) => {
  try {
    // 1. Tìm các log chưa được chấm điểm Groundedness
    // Bỏ qua log bị guardrail từ chối (không có ngữ cảnh để chấm)
    const unevaluatedLogs = await RagLog.find({
      'metrics.groundedness': null,
      'retrievedContextIds.0': { $exists: true }
    }).limit(10);

    if (unevaluatedLogs.length === 0) {
      return res.status(200).json({ message: "Tất cả logs đã được chấm điểm." });
    }

    // Giám khảo dùng LLM_JUDGE_PROVIDER (mặc định = LLM_PROVIDER). Nên dùng model KHÁC model sinh
    // câu trả lời (vd. trả lời bằng ollama:dolphin3, chấm bằng gemini) để tránh model tự chấm mình.
    const judgeProvider = process.env.LLM_JUDGE_PROVIDER || undefined;
    let evaluatedCount = 0;

    for (const log of unevaluatedLogs) {
      // Lấy text thực tế từ các Context ID đã truy xuất
      // Ngữ cảnh thực tế LLM nhận được: thông tin khách sạn + các hạng phòng đã truy xuất
      const [hotels, rooms] = await Promise.all([
        Hotel.find({ _id: { $in: log.retrievedHotelIds || [] } }).select('hotelName description amenities address rating'),
        RoomType.find({ _id: { $in: log.retrievedContextIds } }).select('title description basePrice amenities')
      ]);
      const contextText = [
        ...hotels.map(h => `Khách sạn ${h.hotelName} (${h.address?.city}): ${h.description}. Tiện ích: ${h.amenities.join(', ')}. Điểm: ${h.rating}`),
        ...rooms.map(r => `Phòng ${r.title}: ${r.description || ''}. Giá gốc: ${r.basePrice} (giá theo ngày có thể khác). Tiện ích: ${r.amenities.join(', ')}`)
      ].join("\n\n");

      // 2. Thiết kế Prompt ép LLM làm Giám khảo
      const prompt = `
        Bạn là một giám khảo AI khách quan. Nhiệm vụ của bạn là đánh giá "Groundedness" (Độ bám sát ngữ cảnh) của câu trả lời.
        
        NGỮ CẢNH (Context):
        """${contextText}"""
        
        CÂU TRẢ LỜI CỦA HỆ THỐNG (Answer):
        """${log.llmResponse}"""
        
        QUY TẮC CHẤM ĐIỂM:
        - Điểm 1: Toàn bộ thông tin trong câu trả lời đều có thể tìm thấy trong Ngữ cảnh. Không bịa đặt.
        - Điểm 0: Câu trả lời chứa thông tin không hề xuất hiện trong Ngữ cảnh (Hallucination).
        
        Bắt buộc chỉ trả về một chuỗi JSON hợp lệ với định dạng: {"groundedness": 1} hoặc {"groundedness": 0}. Không giải thích thêm.
      `;

      try {
        // 3. Gọi LLM chấm điểm
        const result = await generateText({ prompt, temperature: 0, maxTokens: 50 }, { provider: judgeProvider });

        // Model local hay viết thêm chữ quanh JSON -> chỉ lấy đúng giá trị 0/1
        const match = result.text.match(/"groundedness"\s*:\s*([01])/);
        if (!match) throw new Error(`Giám khảo trả về không đúng định dạng: ${result.text.slice(0, 100)}`);

        // 4. Cập nhật điểm số vào Database
        log.metrics.groundedness = Number(match[1]);
        await log.save();
        evaluatedCount++;
        
      } catch (err) {
        console.error(`Lỗi chấm điểm cho log ${log._id}:`, err);
        // Bỏ qua lỗi của 1 log để chạy tiếp vòng lặp
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `Đã chấm điểm Groundedness tự động cho ${evaluatedCount} logs.` 
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
exports.getRagAnalytics = async (req, res) => {
  const K = 5;
  try {
    const [recentLogs, labeledLogs, sourceCounts, latency] = await Promise.all([
      RagLog.find().sort({ createdAt: -1 }).limit(50),
      // Toàn bộ log đã gắn nhãn chuẩn (Golden) để tính chỉ số truy xuất
      RagLog.find({ 'goldenContextIds.0': { $exists: true } })
        .select('retrievedContextIds goldenContextIds llmResponse metrics.groundedness'),
      RagLog.aggregate([{ $group: { _id: '$answerSource', count: { $sum: 1 } } }]),
      RagLog.aggregate([{ $match: { latencyMs: { $type: 'number' } } }, { $group: { _id: null, avg: { $avg: '$latencyMs' } } }])
    ]);

    const rows = labeledLogs.map((log) => evaluateQuery(
      log.retrievedContextIds.map(String), log.goldenContextIds.map(String), K
    ));
    const summary = summarize(rows);

    // Citation correctness tính trên mọi log có trích dẫn [n]
    const citations = recentLogs
      .map((log) => citationCorrectness(log.llmResponse, log.retrievedContextIds.length))
      .filter((v) => v !== null);
    const graded = await RagLog.find({ 'metrics.groundedness': { $ne: null } }).select('metrics.groundedness');

    const pct = (v) => (v === null ? null : Number((v * 100).toFixed(2)));
    res.status(200).json({
      success: true,
      data: {
        recentLogs,
        metrics: {
          k: K,
          totalEvaluated: summary.queries,
          avgHitRate: pct(summary.hitRate) ?? 0,
          avgRecall: summary.recall === null ? 0 : Number(summary.recall.toFixed(4)),
          avgPrecision: summary.precision === null ? 0 : Number(summary.precision.toFixed(4)),
          avgNdcg: summary.ndcg === null ? 0 : Number(summary.ndcg.toFixed(4)),
          mrr: summary.mrr === null ? 0 : Number(summary.mrr.toFixed(4)),
          citationCorrectness: citations.length ? pct(citations.reduce((a, b) => a + b, 0) / citations.length) : null,
          groundednessPassRate: graded.length
            ? pct(graded.filter((log) => log.metrics.groundedness === 1).length / graded.length)
            : null,
          answerSources: Object.fromEntries(sourceCounts.map((s) => [s._id || 'unknown', s.count])),
          avgLatencyMs: latency[0] ? Math.round(latency[0].avg) : null
        }
      }
    });
  } catch (error) {
    console.error('Lỗi RAG Analytics:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy dữ liệu RAG Analytics' });
  }
};