// File: middleware/ownershipMiddleware.js
// Kiểm tra QUYỀN SỞ HỮU ở phía server (không dựa vào việc ẩn menu ở frontend):
// Partner chỉ được thao tác trên khách sạn / hạng phòng của chính mình; Admin được thao tác tất cả.
// Phải đặt SAU authenticateUser (cần req.user).
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');

const isOwner = (hotel, user) =>
  user.role === 'Admin' || hotel.partnerId.toString() === user.id;

// getHotelId(req) -> id khách sạn cần kiểm tra. Gắn req.hotel nếu hợp lệ.
const requireHotelOwnership = (getHotelId) => async (req, res, next) => {
  const hotelId = getHotelId(req);
  if (!mongoose.isValidObjectId(hotelId)) {
    return res.status(400).json({ success: false, message: 'Mã khách sạn không hợp lệ' });
  }

  try {
    const hotel = await Hotel.findById(hotelId).select('-embedding');
    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách sạn' });
    }
    if (!isOwner(hotel, req.user)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên khách sạn này' });
    }
    req.hotel = hotel;
    return next();
  } catch (error) {
    console.error('Lỗi kiểm tra quyền sở hữu khách sạn:', error);
    return res.status(500).json({ success: false, message: 'Không thể kiểm tra quyền truy cập' });
  }
};

// getRoomId(req) -> id hạng phòng cần kiểm tra. Gắn req.room và req.hotel nếu hợp lệ.
const requireRoomOwnership = (getRoomId) => async (req, res, next) => {
  const roomId = getRoomId(req);
  if (!mongoose.isValidObjectId(roomId)) {
    return res.status(400).json({ success: false, message: 'Mã hạng phòng không hợp lệ' });
  }

  try {
    const room = await RoomType.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hạng phòng' });
    }
    const hotel = await Hotel.findById(room.hotelId).select('partnerId hotelName status');
    if (!hotel || !isOwner(hotel, req.user)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên hạng phòng này' });
    }
    req.room = room;
    req.hotel = hotel;
    return next();
  } catch (error) {
    console.error('Lỗi kiểm tra quyền sở hữu hạng phòng:', error);
    return res.status(500).json({ success: false, message: 'Không thể kiểm tra quyền truy cập' });
  }
};

module.exports = { requireHotelOwnership, requireRoomOwnership, isOwner };
