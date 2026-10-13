// File: models/RoomType.js (Nhớ đổi tên file)
const mongoose = require('mongoose');

const roomTypeSchema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  title: { type: String, required: true }, 
  description: { type: String }, // Thêm mới
  basePrice: { type: Number, required: true }, // Đổi từ pricePerNight
  maxAdults: { type: Number, required: true }, // Làm phẳng object capacity
  maxChildren: { type: Number, default: 0 },
  totalQuantity: { type: Number, required: true }, // Đổi từ quantity
  amenities: [{ type: String }],
  images: [{ type: String }] // Thêm mới
}, { timestamps: true });

module.exports = mongoose.model('RoomType', roomTypeSchema, 'roomtypes');