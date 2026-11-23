// File: models/Notification.js
// Thông báo trong trang (chuông ở header): đơn mới, đơn bị hủy, hồ sơ được duyệt / từ chối...
// Tự xóa sau 90 ngày (TTL index) để collection không phình mãi.
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['order_new', 'order_paid', 'order_canceled', 'order_expired', 'application_approved', 'application_rejected', 'application_submitted'],
    required: true
  },
  title: { type: String, required: true, maxlength: 150 },
  message: { type: String, maxlength: 500 },
  link: { type: String, maxlength: 300 }, // Đường dẫn trong web khi bấm vào thông báo
  readAt: { type: Date }
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
