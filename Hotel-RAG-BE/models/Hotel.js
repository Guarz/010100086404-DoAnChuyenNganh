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
    // Không đặt default 'Point': nếu khách sạn không có tọa độ mà vẫn lưu { type: 'Point' }
    // thì index 2dsphere sẽ báo lỗi "Can't extract geo keys" và không tạo được khách sạn.
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number], default: undefined }
  },
  rating: { type: Number, default: 0 }, // Điểm trung bình từ Review (1 chữ số thập phân)
  reviewCount: { type: Number, default: 0 },
  amenities: [{ type: String }],
  images: [{ type: String }], // Thêm mới
  embedding: { type: [Number] },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending' // Mặc định phải chờ Admin duyệt
  },
  rejectionReason: { type: String }, // Lý do Admin từ chối (nếu có)
  reviewedAt: { type: Date } // Thời điểm Admin duyệt / từ chối
}, { timestamps: true });

hotelSchema.index({ coordinates: "2dsphere" });

module.exports = mongoose.model('Hotel', hotelSchema);