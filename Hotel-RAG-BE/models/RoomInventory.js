// File: models/RoomInventory.js
const mongoose = require('mongoose');

const roomInventorySchema = new mongoose.Schema({
  roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
  date: { type: Date, required: true }, // Ngày cụ thể (VD: 2026-10-05)
  availableRooms: { type: Number, required: true, min: 0 },
  dynamicPrice: { type: Number } // Giá có thể tăng vào dịp Lễ/Tết. Nếu null thì lấy basePrice
}, { timestamps: true });

// Tạo Unique Index để 1 loại phòng không bị trùng lặp dữ liệu trong 1 ngày
roomInventorySchema.index({ roomTypeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('RoomInventory', roomInventorySchema);