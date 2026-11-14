// File: models/User.js
const mongoose = require('mongoose');
const { provinceSchemaType } = require('../constants/provinces');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true }, // Cập nhật từ 'name'
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
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
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);