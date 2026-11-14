// File: models/TransportCompany.js
// Nhà xe cung cấp dịch vụ xe đưa đón (sân bay <-> khách sạn...).
// Khách hàng đăng ký hồ sơ nhà xe -> Admin duyệt -> tài khoản chuyển sang vai trò 'Transport'.
const mongoose = require('mongoose');
const { provinceSchemaType } = require('../constants/provinces');

const transportCompanySchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, // Mỗi tài khoản 1 nhà xe
  companyName: { type: String, required: true },
  phone: { type: String, required: true },
  licenseNumber: { type: String, required: true }, // Số giấy phép kinh doanh vận tải
  description: { type: String },
  serviceProvinces: [provinceSchemaType({ required: true })], // Các tỉnh/thành phục vụ (danh mục 63 tỉnh)
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  rejectionReason: { type: String },
  reviewedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('TransportCompany', transportCompanySchema);
