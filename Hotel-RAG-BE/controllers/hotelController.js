// File: controllers/hotelController.js
const Hotel = require('../models/Hotel');
const mongoose = require('mongoose');

exports.getAllHotels = async (req, res) => {
  try {
    const hotels = await Hotel.aggregate([
      { $match: { status: 'Approved' } }, // CHỈ LẤY KHÁCH SẠN ĐÃ DUYỆT
      {
        $lookup: {
          from: 'roomtypes', // Đổi từ 'rooms'
          localField: '_id',
          foreignField: 'hotelId',
          as: 'roomTypes' // Đổi tên mảng trả về
        }
      },
      { $project: { embedding: 0 } }
    ]);
    res.status(200).json({ success: true, count: hotels.length, data: hotels });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.getHotelById = async (req, res) => {
  // Tương tự, cập nhật from: 'roomtypes' và as: 'roomTypes'
  // ... code bị rút gọn để tập trung vào thay đổi chính
};