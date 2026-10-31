// File: controllers/userController.js
// Tài khoản của chính người đang đăng nhập (mọi vai trò)
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const PUBLIC_FIELDS = 'fullName email phone role status partnerApplicationStatus address createdAt';

// [GET] /api/users/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(PUBLIC_FIELDS);
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Lỗi lấy thông tin tài khoản:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải thông tin tài khoản' });
  }
};

// [PUT] /api/users/me - Chỉ cho sửa họ tên, SĐT, địa chỉ (không cho tự đổi role/status/email)
exports.updateMe = async (req, res) => {
  const { fullName, phone, address } = req.body;
  const update = {};

  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'Họ tên cần từ 2 đến 100 ký tự' });
    }
    update.fullName = fullName.trim();
  }
  if (phone !== undefined) {
    if (phone !== '' && !/^0\d{9,10}$/.test(String(phone))) {
      return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ' });
    }
    update.phone = phone;
  }
  if (address !== undefined && typeof address === 'object' && address !== null) {
    for (const key of ['street', 'city', 'province']) {
      if (typeof address[key] === 'string') update[`address.${key}`] = address[key].trim().slice(0, 200);
    }
  }

  try {
    const user = await User.findByIdAndUpdate(req.user.id, { $set: update }, { returnDocument: 'after', runValidators: true })
      .select(PUBLIC_FIELDS);
    return res.status(200).json({ success: true, message: 'Đã cập nhật thông tin cá nhân', data: user });
  } catch (error) {
    console.error('Lỗi cập nhật tài khoản:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật thông tin lúc này' });
  }
};

// [PUT] /api/users/me/password - Body: { currentPassword, newPassword }
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Mật khẩu mới cần ít nhất 8 ký tự' });
  }

  try {
    const user = await User.findById(req.user.id).select('password');
    const isMatch = typeof currentPassword === 'string' && await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.status(200).json({ success: true, message: 'Đã đổi mật khẩu' });
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error);
    return res.status(500).json({ success: false, message: 'Không thể đổi mật khẩu lúc này' });
  }
};
