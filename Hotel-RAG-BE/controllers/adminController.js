// File: controllers/adminController.js
const Hotel = require('../models/Hotel');

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

    const updatedHotel = await Hotel.findByIdAndUpdate(
      hotelId,
      { status: 'Approved' },
      { new: true } // Trả về data mới sau khi update
    );

    if (!updatedHotel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách sạn' });
    }

    res.status(200).json({
      success: true,
      message: 'Đã phê duyệt khách sạn thành công! Khách sạn đã được lên sàn.',
      data: updatedHotel
    });
  } catch (error) {
    console.error("Lỗi phê duyệt khách sạn:", error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};