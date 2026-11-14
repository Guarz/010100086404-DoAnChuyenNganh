// File: models/VehicleInventory.js
// Số xe còn trống của một loại xe trong một ngày (giống RoomInventory của khách sạn).
const mongoose = require('mongoose');

const vehicleInventorySchema = new mongoose.Schema({
  vehicleTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleType', required: true },
  date: { type: Date, required: true }, // Mốc 00:00 UTC của ngày đón khách
  availableVehicles: { type: Number, required: true, min: 0 }
}, { timestamps: true });

// Một loại xe chỉ có một bản ghi mỗi ngày
vehicleInventorySchema.index({ vehicleTypeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('VehicleInventory', vehicleInventorySchema);
