const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 1. Hàm kiểm tra đăng nhập (Xác thực Token)
const authenticateUser = async (req, res, next) => {
  const authorization = req.get('authorization');
  const [scheme, token, ...extraParts] = authorization ? authorization.split(' ') : [];

  if (scheme !== 'Bearer' || !token || extraParts.length > 0) {
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để tiếp tục' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET chưa được cấu hình');
    return res.status(500).json({ success: false, message: 'Máy chủ chưa được cấu hình xác thực' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }

  if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string' || !/^[a-f\d]{24}$/i.test(payload.id)) {
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ' });
  }

  try {
    const user = await User.findById(payload.id).select('_id role status');
    if (!user || user.status === 'Locked') {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    }

    req.user = { id: user._id.toString(), role: user.role };
    return next();
  } catch (error) {
    console.error('Lỗi xác thực tài khoản:', error);
    return res.status(500).json({ success: false, message: 'Không thể xác thực tài khoản lúc này' });
  }
};

// 2. Hàm kiểm tra quyền hạn (Phân quyền Role)
const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
  }
  return next();
};

// Xuất cả 2 hàm ra để sử dụng
module.exports = { authenticateUser, authorizeRoles };