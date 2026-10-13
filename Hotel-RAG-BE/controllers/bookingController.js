// File: controllers/bookingController.js
const Booking = require('../models/Booking');
const RoomInventory = require('../models/RoomInventory');
const RoomType = require('../models/RoomType');
const mongoose = require('mongoose');

// [POST] /api/bookings
exports.createBooking = async (req, res) => {
  try {
    const { 
      customerId, 
      hotelId, 
      checkInDate, 
      checkOutDate, 
      bookingDetails, // Mảng: [{ roomTypeId, quantity }]
      specialRequests 
    } = req.body;

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const totalNights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    if (totalNights <= 0) {
      return res.status(400).json({ success: false, message: 'Ngày Check-out phải sau ngày Check-in' });
    }

    let totalAmount = 0;
    const processedDetails = [];

    // 1. KIỂM TRA & TRỪ QUỸ PHÒNG (Cho từng loại phòng khách đặt)
    for (const item of bookingDetails) {
      const { roomTypeId, quantity } = item;

      // Tìm xem phòng này có tồn tại không
      const roomType = await RoomType.findById(roomTypeId);
      if (!roomType) throw new Error(`Không tìm thấy loại phòng: ${roomTypeId}`);

      // Tìm các ngày khách muốn ở trong Inventory
      const inventories = await RoomInventory.find({
        roomTypeId: roomTypeId,
        date: { $gte: checkIn,$lt: checkOut }
      }).sort('date');

      if (inventories.length < totalNights) {
        throw new Error(`Phòng ${roomType.title} chưa được mở bán trong khoảng thời gian này`);
      }

      let roomTotalCost = 0;

      // Kiểm tra xem tất cả các đêm đó có đủ số lượng trống không
      for (const inv of inventories) {
        if (inv.availableRooms < quantity) {
          throw new Error(`Phòng ${roomType.title} đã hết chỗ vào ngày ${inv.date.toLocaleDateString('vi-VN')}`);
        }
        
        // Tính tiền dựa trên dynamicPrice của từng ngày
        const priceForThisNight = inv.dynamicPrice || roomType.basePrice;
        roomTotalCost += (priceForThisNight * quantity);
        
        // Trừ số lượng phòng trực tiếp vào biến bộ nhớ (chưa save DB vội)
        inv.availableRooms -= quantity;
      }

      // Cộng dồn vào tổng tiền của cả chuyến đi
      totalAmount += roomTotalCost;

      // Chuẩn bị dữ liệu chi tiết booking để lưu
      processedDetails.push({
        roomTypeId: roomType._id,
        quantity: quantity,
        unitPrice: roomType.basePrice, // Lưu lại giá gốc tham khảo
        totalNights: totalNights
      });

      // LƯU DB: Chỉ khi nào check xong hết các ngày không lỗi mới tiến hành cập nhật (Trừ phòng)
      for (const inv of inventories) {
        await inv.save();
      }
    }

    // 2. TẠO ĐƠN BOOKING
    const newBooking = new Booking({
      customerId,
      hotelId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      totalAmount,
      specialRequests,
      bookingStatus: 'Pending',
      bookingDetails: processedDetails
    });

    await newBooking.save();

    res.status(201).json({
      success: true,
      message: 'Đặt phòng thành công!',
      data: newBooking
    });

  } catch (error) {
    console.error("Lỗi Đặt phòng:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};