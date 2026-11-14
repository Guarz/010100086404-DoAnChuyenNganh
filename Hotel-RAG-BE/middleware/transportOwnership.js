// File: middleware/transportOwnership.js
// Kiểm tra QUYỀN SỞ HỮU phía nhà xe: nhà xe chỉ thao tác trên loại xe / tuyến / đơn của mình; Admin được tất cả.
// Đặt SAU authenticateUser + authorizeRoles('Transport', 'Admin').
const mongoose = require('mongoose');
const TransportCompany = require('../models/TransportCompany');
const VehicleType = require('../models/VehicleType');
const TransferRoute = require('../models/TransferRoute');

const ownsCompany = (company, user) => user.role === 'Admin' || company.ownerId.toString() === user.id;

// Nhà xe của chính người đang đăng nhập, phải đã được duyệt -> req.company
const requireApprovedCompany = async (req, res, next) => {
  try {
    const company = await TransportCompany.findOne({ ownerId: req.user.id });
    if (!company) return res.status(404).json({ success: false, message: 'Bạn chưa có hồ sơ nhà xe' });
    if (company.status !== 'Approved') {
      return res.status(403).json({ success: false, message: 'Hồ sơ nhà xe chưa được duyệt' });
    }
    req.company = company;
    return next();
  } catch (error) {
    console.error('Lỗi tải nhà xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể kiểm tra quyền truy cập' });
  }
};

const requireOwnership = (Model, label, getId) => async (req, res, next) => {
  const id = getId(req);
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: `Mã ${label} không hợp lệ` });
  }
  try {
    const doc = await Model.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: `Không tìm thấy ${label}` });
    const company = await TransportCompany.findById(doc.companyId);
    if (!company || !ownsCompany(company, req.user)) {
      return res.status(403).json({ success: false, message: `Bạn không có quyền thao tác trên ${label} này` });
    }
    req.company = company;
    req[Model === VehicleType ? 'vehicleType' : 'route'] = doc;
    return next();
  } catch (error) {
    console.error(`Lỗi kiểm tra quyền sở hữu ${label}:`, error);
    return res.status(500).json({ success: false, message: 'Không thể kiểm tra quyền truy cập' });
  }
};

const requireVehicleOwnership = (getId) => requireOwnership(VehicleType, 'loại xe', getId);
const requireRouteOwnership = (getId) => requireOwnership(TransferRoute, 'tuyến', getId);

module.exports = { requireApprovedCompany, requireVehicleOwnership, requireRouteOwnership, ownsCompany };
