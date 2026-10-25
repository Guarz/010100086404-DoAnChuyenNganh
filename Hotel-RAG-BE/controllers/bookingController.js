// File: controllers/bookingController.js
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const RoomInventory = require('../models/RoomInventory');
const RoomType = require('../models/RoomType');
const mongoose = require('mongoose');

const parseDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

// [POST] /api/bookings
exports.createBooking = async (req, res) => {
  try {
    const { 
      hotelId, 
      checkInDate, 
      checkOutDate, 
      bookingDetails, // Mảng: [{ roomTypeId, quantity }]
      specialRequests 
    } = req.body;

    if (!Array.isArray(bookingDetails) || bookingDetails.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất một loại phòng' });
    }

    const checkIn = parseDateOnly(checkInDate);
    const checkOut = parseDateOnly(checkOutDate);

    if (!checkIn || !checkOut) {
      return res.status(400).json({ success: false, message: 'Ngày nhận phòng hoặc trả phòng không hợp lệ' });
    }

    const checkInUtc = Date.UTC(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
    const checkOutUtc = Date.UTC(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
    const totalNights = (checkOutUtc - checkInUtc) / (1000 * 60 * 60 * 24);

    if (totalNights <= 0) {
      return res.status(400).json({ success: false, message: 'Ngày Check-out phải sau ngày Check-in' });
    }

    let totalAmount = 0;
    const processedDetails = [];

    // Check availability and calculate the quote without reserving inventory.
    for (const item of bookingDetails) {
      const { roomTypeId, quantity } = item;
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ success: false, message: 'Số lượng phòng phải là số nguyên lớn hơn 0' });
      }

      // Tìm xem phòng này có tồn tại không
      const roomType = await RoomType.findById(roomTypeId);
      if (!roomType) throw new Error(`Không tìm thấy loại phòng: ${roomTypeId}`);
      if (roomType.hotelId.toString() !== hotelId) {
        return res.status(400).json({ success: false, message: 'Loại phòng không thuộc khách sạn đã chọn' });
      }

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

    }

    // Keep unpaid checkout requests temporarily; they are not reservations.
    const newBooking = new Booking({
      customerId: req.user.id,
      hotelId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
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

exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      customerId: req.user.id,
      bookingStatus: { $in: ['Confirmed', 'Completed'] }
    })
      .sort({ createdAt: -1 })
      .populate('hotelId', 'hotelName address images')
      .populate('bookingDetails.roomTypeId', 'title');

    const payments = await Payment.find({
      bookingId: { $in: bookings.map((booking) => booking._id) }
    }).sort({ createdAt: -1 });
    const paymentByBookingId = new Map();
    for (const payment of payments) {
      const bookingId = payment.bookingId.toString();
      if (!paymentByBookingId.has(bookingId)) {
        paymentByBookingId.set(bookingId, payment);
      }
    }

    const data = bookings.map((booking) => ({
      ...booking.toObject(),
      payment: paymentByBookingId.get(booking._id.toString()) || null
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy lịch sử đặt phòng:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải lịch sử đặt phòng lúc này' });
  }
};
// [GET] /api/bookings/:id - Lấy chi tiết 1 đơn hàng (Dùng cho trang Checkout)
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      customerId: req.user.id,
      bookingStatus: { $in: ['Pending', 'Confirmed'] }
    })
      .populate('hotelId', 'hotelName address')
      .populate('bookingDetails.roomTypeId', 'title basePrice');

    if (!booking) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn đặt phòng" });
    }

    if (booking.bookingStatus === 'Pending') {
      const expiresAt = booking.expiresAt ||
        new Date(booking.createdAt.getTime() + 5 * 60 * 1000);
      if (expiresAt <= new Date()) {
        await Booking.deleteOne({ _id: booking._id, bookingStatus: 'Pending' });
        return res.status(410).json({
          success: false,
          message: "Đơn tạm đã hết hạn và được hủy. Vui lòng đặt lại nếu bạn vẫn muốn tiếp tục."
        });
      }
      if (!booking.expiresAt) {
        booking.expiresAt = expiresAt;
        await booking.save();
      }
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error("Lỗi lấy chi tiết đơn:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// [PUT] /api/bookings/:id/cancel - Xóa đơn tạm chưa thanh toán
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking || booking.customerId.toString() !== req.user.id) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn đặt phòng" });
    }

    if (booking.bookingStatus !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể xóa đơn tạm chưa thanh toán"
      });
    }

    await Booking.deleteOne({ _id: booking._id, bookingStatus: 'Pending' });
    res.status(200).json({
      success: true,
      message: "Đã xóa đơn tạm. Số lượng phòng không bị thay đổi."
    });
  } catch (error) {
    console.error("Lỗi hủy đơn:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi hủy đơn" });
  }
};