// File: models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true }, // Cập nhật từ 'name'
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  role: { 
    type: String, 
    enum: ['Customer', 'Partner', 'Admin'], // Chuẩn hóa viết hoa chữ đầu
    default: 'Customer' 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Locked'], 
    default: 'Active' 
  },
  address: { // Nhúng object Address
    street: String,
    city: String,
    province: String
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);