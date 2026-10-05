// File: models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  
  checkInDate: { type: Date, required: true },
  checkOutDate: { type: Date, required: true },
  totalAmount: { type: Number, required: true },
  specialRequests: { type: String },
  
  bookingStatus: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Canceled', 'Completed'],
    default: 'Pending'
  },
  
  // Nhúng mảng BookingDetail trực tiếp vào đây
  bookingDetails: [{
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
    quantity: { type: Number, required: true, min: 1 }, // Số lượng phòng khách đặt
    unitPrice: { type: Number, required: true }, // Giá chốt tại thời điểm đặt (để sau này giá phòng tăng thì bill không bị đổi)
    totalNights: { type: Number, required: true }
  }]
}, { timestamps: true }); 
// timestamps tự động tạo createdAt (chính là BookingDate) và updatedAt

module.exports = mongoose.model('Booking', bookingSchema);