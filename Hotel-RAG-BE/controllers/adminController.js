// File: controllers/adminController.js
const Hotel = require('../models/Hotel');
const { generateHotelEmbedding } = require('../services/aiService');

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

// [PUT] /api/admin/hotels/:id/approve - Phê duyệt khách sạn
exports.approveHotel = async (req, res) => {
  try {
    const hotelId = req.params.id;

    // 1. Tìm khách sạn đang chờ duyệt
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách sạn' });
    }

    // 2. MỚI: Gọi AI dịch thông tin khách sạn thành Vector
    console.log("Đang tạo Vector Embedding cho khách sạn...");
    const embeddingData = await generateHotelEmbedding(hotel);

    // 3. Cập nhật trạng thái và lưu vector vào DB
    hotel.status = 'Approved';
    hotel.embedding = embeddingData; 
    
    await hotel.save(); // Lưu lại thay đổi

    res.status(200).json({
      success: true,
      message: 'Đã duyệt khách sạn và tạo Vector AI thành công!',
      data: hotel
    });
  } catch (error) {
    console.error("Lỗi phê duyệt khách sạn:", error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};