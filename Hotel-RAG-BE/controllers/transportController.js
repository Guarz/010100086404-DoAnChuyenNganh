// File: controllers/transportController.js
// Phía NHÀ XE: hồ sơ nhà xe, loại xe, tuyến đưa đón, số xe trống theo ngày, đơn đặt xe.
// Phía ADMIN: duyệt / từ chối hồ sơ nhà xe.
const mongoose = require('mongoose');
const notifications = require('../services/notificationService');
const User = require('../models/User');
const TransportCompany = require('../models/TransportCompany');
const VehicleType = require('../models/VehicleType');
const TransferRoute = require('../models/TransferRoute');
const VehicleInventory = require('../models/VehicleInventory');
const TransferBooking = require('../models/TransferBooking');
const { sanitizeAmenities, sanitizeImages } = require('../services/amenityCatalog');
const { createInitialInventory, parseDateKey, todayKey, DAY_MS } = require('../services/transferService');
const { normalizeProvince } = require('../constants/provinces');

// ---------- Validate ----------
const text = (value, { min = 1, max, label }) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new Error(`${label} cần từ ${min} đến ${max} ký tự`);
  }
  return value.trim();
};
const int = (value, { min, max, label }) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} phải là số nguyên từ ${min} đến ${max}`);
  return n;
};
const phone = (value) => {
  if (!/^0\d{9,10}$/.test(String(value || ''))) throw new Error('Số điện thoại không hợp lệ');
  return String(value);
};
// Tỉnh/thành phục vụ: chỉ nhận giá trị trong danh mục 63 tỉnh
const provinceOf = (value, label = 'Tỉnh/TP') => {
  const province = normalizeProvince(value);
  if (!province) throw new Error(`${label} phải chọn trong danh sách 63 tỉnh thành`);
  return province;
};
const provinces = (value) => {
  if (!Array.isArray(value) || !value.length) throw new Error('Chọn ít nhất 1 tỉnh/thành phục vụ');
  return [...new Set(value.map((p) => provinceOf(p, `"${p}"`)))].slice(0, 63);
};
const badRequest = (res, error) => res.status(400).json({ success: false, message: error.message });

// =====================================================
// HỒ SƠ NHÀ XE
// =====================================================

// [GET] /api/transport/my-company - hồ sơ nhà xe của người đang đăng nhập (null nếu chưa đăng ký)
exports.getMyCompany = async (req, res) => {
  try {
    const company = await TransportCompany.findOne({ ownerId: req.user.id });
    return res.status(200).json({ success: true, data: company });
  } catch (error) {
    console.error('Lỗi tải hồ sơ nhà xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải hồ sơ nhà xe' });
  }
};

// [POST] /api/transport/apply - khách hàng đăng ký trở thành nhà xe (chờ Admin duyệt)
exports.applyCompany = async (req, res) => {
  let data;
  try {
    data = {
      companyName: text(req.body.companyName, { min: 2, max: 150, label: 'Tên nhà xe' }),
      phone: phone(req.body.phone),
      licenseNumber: text(req.body.licenseNumber, { min: 3, max: 50, label: 'Số giấy phép' }),
      description: typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 2000) : '',
      serviceProvinces: provinces(req.body.serviceProvinces)
    };
  } catch (error) {
    return badRequest(res, error);
  }

  try {
    const user = await User.findById(req.user.id).select('role');
    if (user.role !== 'Customer') {
      return res.status(409).json({ success: false, message: 'Chỉ tài khoản khách hàng mới đăng ký làm nhà xe được' });
    }
    const existing = await TransportCompany.findOne({ ownerId: req.user.id });
    if (existing && existing.status !== 'Rejected') {
      return res.status(409).json({ success: false, message: 'Bạn đã có hồ sơ nhà xe đang chờ duyệt hoặc đã được duyệt' });
    }

    // Hồ sơ bị từ chối được sửa và gửi lại
    const company = existing
      ? await TransportCompany.findByIdAndUpdate(existing._id,
        { $set: { ...data, status: 'Pending', rejectionReason: null, reviewedAt: null } }, { returnDocument: 'after' })
      : await TransportCompany.create({ ...data, ownerId: req.user.id });

    await notifications.notifyAdminsNewSubmission(`Hồ sơ nhà xe "${company.companyName}"`, '/admin?tab=transport');
    return res.status(201).json({ success: true, message: 'Đã gửi hồ sơ nhà xe. Vui lòng chờ quản trị viên duyệt.', data: company });
  } catch (error) {
    console.error('Lỗi đăng ký nhà xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể gửi hồ sơ lúc này' });
  }
};

// [PUT] /api/transport/my-company - nhà xe sửa thông tin liên hệ / thành phố phục vụ
exports.updateMyCompany = async (req, res) => {
  const update = {};
  try {
    if (req.body.companyName !== undefined) update.companyName = text(req.body.companyName, { min: 2, max: 150, label: 'Tên nhà xe' });
    if (req.body.phone !== undefined) update.phone = phone(req.body.phone);
    if (req.body.description !== undefined) update.description = String(req.body.description).trim().slice(0, 2000);
    if (req.body.serviceProvinces !== undefined) update.serviceProvinces = provinces(req.body.serviceProvinces);
  } catch (error) {
    return badRequest(res, error);
  }
  try {
    const company = await TransportCompany.findByIdAndUpdate(req.company._id, { $set: update }, { returnDocument: 'after' });
    return res.status(200).json({ success: true, message: 'Đã cập nhật hồ sơ nhà xe', data: company });
  } catch (error) {
    console.error('Lỗi cập nhật nhà xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật lúc này' });
  }
};

// =====================================================
// LOẠI XE
// =====================================================
const vehicleFields = (body, { partial }) => {
  const out = {};
  const has = (key) => body[key] !== undefined;
  if (!partial || has('name')) out.name = text(body.name, { min: 2, max: 100, label: 'Tên loại xe' });
  if (!partial || has('seats')) out.seats = int(body.seats, { min: 1, max: 60, label: 'Số chỗ' });
  if (has('luggage')) out.luggage = int(body.luggage, { min: 0, max: 60, label: 'Số vali' });
  if (!partial || has('totalVehicles')) out.totalVehicles = int(body.totalVehicles, { min: 1, max: 500, label: 'Tổng số xe' });
  if (has('amenities')) out.amenities = sanitizeAmenities(body.amenities);
  if (has('images')) out.images = sanitizeImages(body.images);
  return out;
};

// [GET] /api/transport/vehicles - loại xe + tuyến của nhà xe mình
exports.listVehicles = async (req, res) => {
  try {
    const vehicles = await VehicleType.find({ companyId: req.company._id }).sort({ createdAt: 1 }).lean();
    const routes = await TransferRoute.find({ vehicleTypeId: { $in: vehicles.map((v) => v._id) } }).sort({ province: 1 }).lean();
    const data = vehicles.map((v) => ({ ...v, routes: routes.filter((r) => r.vehicleTypeId.toString() === v._id.toString()) }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi tải loại xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách xe' });
  }
};

// [POST] /api/transport/vehicles - thêm loại xe, tự mở 60 ngày quỹ xe
exports.createVehicle = async (req, res) => {
  let data;
  try {
    data = vehicleFields(req.body, { partial: false });
  } catch (error) {
    return badRequest(res, error);
  }
  try {
    const vehicle = await VehicleType.create({ ...data, companyId: req.company._id });
    await createInitialInventory(vehicle);
    return res.status(201).json({ success: true, message: 'Đã thêm loại xe và mở lịch 60 ngày tới', data: vehicle });
  } catch (error) {
    console.error('Lỗi thêm loại xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể thêm loại xe lúc này' });
  }
};

// [PUT] /api/transport/vehicles/:vehicleId - sửa loại xe; đổi tổng số xe thì cộng/trừ chênh lệch vào lịch từ hôm nay
exports.updateVehicle = async (req, res) => {
  let update;
  try {
    update = vehicleFields(req.body, { partial: true });
    if (req.body.isActive !== undefined) update.isActive = Boolean(req.body.isActive);
  } catch (error) {
    return badRequest(res, error);
  }
  if (!Object.keys(update).length) return res.status(400).json({ success: false, message: 'Không có thông tin nào để cập nhật' });

  try {
    const before = req.vehicleType;
    const updated = await VehicleType.findByIdAndUpdate(before._id, { $set: update }, { returnDocument: 'after', runValidators: true });
    const delta = update.totalVehicles !== undefined ? update.totalVehicles - before.totalVehicles : 0;
    if (delta !== 0) {
      await VehicleInventory.updateMany(
        { vehicleTypeId: before._id, date: { $gte: todayKey() } },
        [{ $set: { availableVehicles: { $max: [0, { $add: ['$availableVehicles', delta] }] } } }],
        { updatePipeline: true }
      );
    }
    return res.status(200).json({ success: true, message: 'Đã cập nhật loại xe', data: updated });
  } catch (error) {
    console.error('Lỗi cập nhật loại xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật loại xe lúc này' });
  }
};

// =====================================================
// TUYẾN ĐƯA ĐÓN
// =====================================================
const routeFields = (body, { partial, company }) => {
  const out = {};
  const has = (key) => body[key] !== undefined;
  if (!partial || has('province')) {
    out.province = provinceOf(body.province);
    if (company && !company.serviceProvinces.includes(out.province)) {
      throw new Error(`Nhà xe chưa đăng ký phục vụ ${out.province}. Thêm tỉnh này vào hồ sơ nhà xe trước.`);
    }
  }
  if (!partial || has('fromPlace')) out.fromPlace = text(body.fromPlace, { min: 2, max: 150, label: 'Điểm đón' });
  if (!partial || has('toPlace')) out.toPlace = text(body.toPlace, { min: 2, max: 150, label: 'Điểm trả' });
  if (!partial || has('price')) out.price = int(body.price, { min: 10000, max: 50000000, label: 'Giá' });
  if (has('durationMin')) out.durationMin = int(body.durationMin, { min: 5, max: 1440, label: 'Thời gian di chuyển' });
  if (has('isActive')) out.isActive = Boolean(body.isActive);
  return out;
};

// [POST] /api/transport/vehicles/:vehicleId/routes
exports.createRoute = async (req, res) => {
  let data;
  try {
    data = routeFields(req.body, { partial: false, company: req.company });
  } catch (error) {
    return badRequest(res, error);
  }
  try {
    const route = await TransferRoute.create({ ...data, vehicleTypeId: req.vehicleType._id, companyId: req.company._id });
    return res.status(201).json({ success: true, message: 'Đã thêm tuyến', data: route });
  } catch (error) {
    console.error('Lỗi thêm tuyến:', error);
    return res.status(500).json({ success: false, message: 'Không thể thêm tuyến lúc này' });
  }
};

// [PUT] /api/transport/routes/:routeId
exports.updateRoute = async (req, res) => {
  let update;
  try {
    update = routeFields(req.body, { partial: true, company: req.company });
  } catch (error) {
    return badRequest(res, error);
  }
  if (!Object.keys(update).length) return res.status(400).json({ success: false, message: 'Không có thông tin nào để cập nhật' });
  try {
    const route = await TransferRoute.findByIdAndUpdate(req.route._id, { $set: update }, { returnDocument: 'after' });
    return res.status(200).json({ success: true, message: 'Đã cập nhật tuyến', data: route });
  } catch (error) {
    console.error('Lỗi cập nhật tuyến:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật tuyến lúc này' });
  }
};

// =====================================================
// SỐ XE TRỐNG THEO NGÀY
// =====================================================

// [GET] /api/transport/vehicles/:vehicleId/inventory?startDate=&endDate=
exports.getVehicleInventory = async (req, res) => {
  const start = parseDateKey(req.query.startDate) || todayKey();
  const end = parseDateKey(req.query.endDate) || new Date(start.getTime() + 13 * DAY_MS);
  if (end < start || end - start > 92 * DAY_MS) {
    return res.status(400).json({ success: false, message: 'Khoảng ngày không hợp lệ (tối đa 3 tháng)' });
  }
  try {
    const data = await VehicleInventory.find({ vehicleTypeId: req.vehicleType._id, date: { $gte: start, $lte: end } }).sort('date');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Lỗi tải lịch xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải lịch xe' });
  }
};

// [PUT] /api/transport/vehicles/:vehicleId/inventory  Body: { startDate, endDate, availableVehicles }
exports.updateVehicleInventory = async (req, res) => {
  const start = parseDateKey(req.body.startDate);
  const end = parseDateKey(req.body.endDate);
  if (!start || !end || end < start || end - start > 366 * DAY_MS) {
    return res.status(400).json({ success: false, message: 'Ngày phải có dạng YYYY-MM-DD, tối đa 1 năm mỗi lần' });
  }
  let quantity;
  try {
    quantity = int(req.body.availableVehicles, { min: 0, max: req.vehicleType.totalVehicles, label: 'Số xe trống' });
  } catch (error) {
    return badRequest(res, error);
  }
  try {
    const ops = [];
    for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
      ops.push({ updateOne: {
        filter: { vehicleTypeId: req.vehicleType._id, date: new Date(t) },
        update: { $set: { availableVehicles: quantity } },
        upsert: true
      } });
    }
    await VehicleInventory.bulkWrite(ops);
    return res.status(200).json({ success: true, message: `Đã cập nhật số xe trống cho ${ops.length} ngày` });
  } catch (error) {
    console.error('Lỗi cập nhật lịch xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật lịch xe' });
  }
};

// =====================================================
// ĐƠN ĐẶT XE CỦA NHÀ XE
// =====================================================

// [GET] /api/transport/bookings?status=
exports.getCompanyBookings = async (req, res) => {
  const allowed = ['Pending', 'Confirmed', 'Canceled', 'Completed'];
  const statuses = req.query.status && req.query.status !== 'all'
    ? String(req.query.status).split(',').filter((s) => allowed.includes(s))
    : ['Confirmed', 'Completed', 'Canceled'];
  try {
    const bookings = await TransferBooking.find({ companyId: req.company._id, status: { $in: statuses } })
      .sort({ pickupTime: 1 })
      .populate('customerId', 'fullName email phone')
      .populate('routeId', 'province fromPlace toPlace')
      .populate('vehicleTypeId', 'name seats')
      .lean();

    const today = todayKey().getTime();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const summary = { pickupsToday: 0, upcoming7Days: 0, bookingsThisMonth: 0, revenueThisMonth: 0 };
    for (const b of bookings) {
      const day = new Date(b.serviceDate).getTime();
      if (b.status !== 'Canceled' && new Date(b.createdAt) >= monthStart) {
        summary.bookingsThisMonth++;
        summary.revenueThisMonth += b.totalAmount;
      }
      if (b.status !== 'Confirmed') continue;
      if (day === today) summary.pickupsToday++;
      if (day >= today && day < today + 7 * DAY_MS) summary.upcoming7Days++;
    }
    return res.status(200).json({ success: true, summary, data: bookings });
  } catch (error) {
    console.error('Lỗi tải đơn nhà xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải đơn đặt xe' });
  }
};

// [PUT] /api/transport/bookings/:id/complete - xác nhận đã đưa đón khách
exports.completeCompanyBooking = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Mã đơn không hợp lệ' });
  try {
    const booking = await TransferBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn' });
    if (booking.companyId.toString() !== req.company._id.toString()) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xử lý đơn này' });
    }
    if (booking.status !== 'Confirmed') return res.status(400).json({ success: false, message: 'Chỉ đơn đã thanh toán mới xác nhận hoàn thành được' });
    if (booking.serviceDate > todayKey()) return res.status(400).json({ success: false, message: 'Chưa tới ngày đón khách' });
    booking.status = 'Completed';
    await booking.save();
    return res.status(200).json({ success: true, message: 'Đã xác nhận hoàn thành chuyến', data: { _id: booking._id, status: booking.status } });
  } catch (error) {
    console.error('Lỗi xác nhận chuyến:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật đơn lúc này' });
  }
};

// =====================================================
// ADMIN DUYỆT NHÀ XE
// =====================================================

// [GET] /api/admin/transport-companies?status=Pending|Approved|Rejected|all
exports.adminListCompanies = async (req, res) => {
  const { status = 'all' } = req.query;
  if (!['Pending', 'Approved', 'Rejected', 'all'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái lọc không hợp lệ' });
  }
  try {
    const [companies, counts] = await Promise.all([
      TransportCompany.find(status === 'all' ? {} : { status }).populate('ownerId', 'fullName email phone').sort({ createdAt: status === 'Pending' ? 1 : -1 }),
      TransportCompany.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);
    const summary = { Pending: 0, Approved: 0, Rejected: 0, all: 0 };
    counts.forEach(({ _id, count }) => { summary[_id] = count; summary.all += count; });
    return res.status(200).json({ success: true, summary, data: companies });
  } catch (error) {
    console.error('Lỗi tải danh sách nhà xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách nhà xe' });
  }
};

// [PUT] /api/admin/transport-companies/:id/status  Body: { status: 'Approved' | 'Rejected', reason? }
exports.adminUpdateCompanyStatus = async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Mã nhà xe không hợp lệ' });
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái chỉ được là Approved hoặc Rejected' });
  }
  try {
    const company = await TransportCompany.findById(id);
    if (!company) return res.status(404).json({ success: false, message: 'Không tìm thấy nhà xe' });
    if (company.status === status) return res.status(409).json({ success: false, message: 'Nhà xe đã ở trạng thái này' });

    company.status = status;
    company.reviewedAt = new Date();
    company.rejectionReason = status === 'Rejected' && typeof reason === 'string' ? reason.trim().slice(0, 500) : undefined;
    await company.save();

    // Duyệt -> tài khoản thành 'Transport'; gỡ duyệt -> trả về 'Customer'
    const owner = await User.findById(company.ownerId).select('role');
    if (status === 'Approved' && owner.role === 'Customer') owner.role = 'Transport';
    if (status === 'Rejected' && owner.role === 'Transport') owner.role = 'Customer';
    await owner.save();
    await notifications.notifyReviewResult(company.ownerId, {
      approved: status === 'Approved', subject: `Hồ sơ nhà xe "${company.companyName}"`, reason: company.rejectionReason,
      link: status === 'Approved' ? '/transport' : '/transport-apply'
    });

    await company.populate('ownerId', 'fullName email phone');
    return res.status(200).json({
      success: true,
      message: status === 'Approved' ? `Đã duyệt nhà xe "${company.companyName}"` : `Đã từ chối nhà xe "${company.companyName}"`,
      data: company
    });
  } catch (error) {
    console.error('Lỗi duyệt nhà xe:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật nhà xe lúc này' });
  }
};
