// File: models/TransferRoute.js
// Tuyến đưa đón của một loại xe, giá tính theo xe cho mỗi chuyến (không tính theo người).
const mongoose = require('mongoose');
const { provinceSchemaType } = require('../constants/provinces');

const transferRouteSchema = new mongoose.Schema({
  vehicleTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleType', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportCompany', required: true }, // Lưu thêm để lọc / kiểm tra sở hữu nhanh
  province: provinceSchemaType({ required: true }), // Tỉnh/thành phục vụ, khớp Hotel.address.province
  fromPlace: { type: String, required: true }, // vd. "Sân bay Đà Nẵng"
  toPlace: { type: String, required: true }, // vd. "Khách sạn khu vực Mỹ Khê"
  price: { type: Number, required: true, min: 0 }, // Giá mỗi xe mỗi chuyến (VNĐ)
  durationMin: { type: Number, default: 30 }, // Thời gian di chuyển ước tính (phút)
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

transferRouteSchema.index({ province: 1, isActive: 1 });

module.exports = mongoose.model('TransferRoute', transferRouteSchema);
