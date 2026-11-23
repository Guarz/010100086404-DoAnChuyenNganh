// File: models/User.js
const mongoose = require('mongoose');
const { provinceSchemaType } = require('../constants/provinces');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true }, // Cập nhật từ 'name'
  // Tên đăng nhập: chữ thường, số, dấu chấm, gạch dưới (3–30 ký tự). sparse: tài khoản cũ chưa có
  // vẫn hợp lệ cho tới khi seed tạo tên đăng nhập.
  username: {
    type: String, unique: true, sparse: true, lowercase: true, trim: true,
    match: [/^[a-z0-9._]{3,30}$/, 'Tên đăng nhập 3–30 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới']
  },
  // Một email được dùng cho nhiều tài khoản (mỗi tài khoản phân biệt bằng tên đăng nhập)
  email: { type: String, required: true, index: true },
  password: { type: String, required: true },
  // Xác nhận email: false = đã đăng ký nhưng chưa bấm link xác nhận (chưa được đăng nhập).
  // Tài khoản cũ không có trường này được coi là đã xác nhận.
  emailVerified: Boolean,
  // Token gửi qua email chỉ lưu dạng SHA-256, không trả về client (select: false)
  emailVerifyTokenHash: { type: String, select: false },
  emailVerifyExpires: { type: Date, select: false },
  resetPasswordTokenHash: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
  // Chống gửi mail liên tục: tối thiểu 60 giây giữa 2 email cùng loại
  lastVerifyMailAt: { type: Date, select: false },
  lastResetMailAt: { type: Date, select: false },
  phone: String,
  role: { 
    type: String, 
    enum: ['Customer', 'Partner', 'Transport', 'Admin'], // Transport = nhà xe đưa đón
    default: 'Customer' 
  },
  partnerApplicationStatus: {
    type: String,
    enum: ['NotRequested', 'Pending', 'Approved', 'Rejected'],
    default: 'NotRequested'
  },
  status: { 
    type: String, 
    enum: ['Active', 'Locked'], 
    default: 'Active' 
  },
  address: { // Nhúng object Address
    street: String,
    city: String,
    province: provinceSchemaType() // Không bắt buộc, nhưng nếu có phải thuộc 63 tỉnh/thành
  },
  // Danh sách khách sạn yêu thích (lưu để xem sau)
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);