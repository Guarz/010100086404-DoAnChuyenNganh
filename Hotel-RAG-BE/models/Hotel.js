// File: models/Hotel.js
const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hotelName: { type: String, required: true }, // Cập nhật từ 'name'
  description: { type: String, required: true },
  address: {
    street: String,
    city: String,
    province: String,
  },
  coordinates: { // Đưa ra ngoài cho phẳng theo ERD
    type: { type: String, default: 'Point' },
    coordinates: [Number] 
  },
  rating: { type: Number, default: 0 },
  amenities: [{ type: String }],
  images: [{ type: String }], // Thêm mới
  embedding: { type: [Number] },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved'], 
    default: 'Pending' // Mặc định phải chờ Admin duyệt
  }
}, { timestamps: true });

hotelSchema.index({ coordinates: "2dsphere" });

module.exports = mongoose.model('Hotel', hotelSchema);