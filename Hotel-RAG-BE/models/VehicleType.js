// File: models/VehicleType.js
// Loại xe của một nhà xe (vd. Sedan 4 chỗ, SUV 7 chỗ, Limousine 9 chỗ).
const mongoose = require('mongoose');

const vehicleTypeSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportCompany', required: true },
  name: { type: String, required: true },
  seats: { type: Number, required: true, min: 1 }, // Số khách tối đa mỗi xe (không tính tài xế)
  luggage: { type: Number, default: 0 }, // Số vali tối đa mỗi xe
  totalVehicles: { type: Number, required: true, min: 1 }, // Tổng số xe loại này của nhà xe
  amenities: [{ type: String }],
  images: [{ type: String }],
  isActive: { type: Boolean, default: true } // false = tạm ngừng nhận khách
}, { timestamps: true });

module.exports = mongoose.model('VehicleType', vehicleTypeSchema);
