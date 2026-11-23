// File: controllers/notificationController.js - thông báo trong trang của người đang đăng nhập
const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// [GET] /api/notifications?limit=20 -> { data, unreadCount }
exports.listNotifications = async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const [data, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ userId: req.user.id, readAt: { $exists: false } })
    ]);
    return res.status(200).json({ success: true, data, unreadCount });
  } catch (error) {
    console.error('Lỗi tải thông báo:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải thông báo' });
  }
};

// [PUT] /api/notifications/:id/read
exports.markRead = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
  try {
    const result = await Notification.updateOne(
      { _id: req.params.id, userId: req.user.id, readAt: { $exists: false } },
      { $set: { readAt: new Date() } }
    );
    return res.status(200).json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error('Lỗi đánh dấu đã đọc:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật thông báo' });
  }
};

// [PUT] /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, readAt: { $exists: false } },
      { $set: { readAt: new Date() } }
    );
    return res.status(200).json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    console.error('Lỗi đánh dấu đã đọc tất cả:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật thông báo' });
  }
};
