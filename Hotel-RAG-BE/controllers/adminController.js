// File: controllers/adminController.js
const Hotel = require('../models/Hotel');
const User = require('../models/User');
const mongoose = require('mongoose');
const { generateHotelEmbedding } = require('../services/aiService');

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
      { new: true, runValidators: true }
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