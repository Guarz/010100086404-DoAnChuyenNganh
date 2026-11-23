// File: services/transferService.js
// Giữ / trả xe đưa đón — cùng cơ chế với services/inventoryService.js của khách sạn:
// trừ nguyên tử theo điều kiện, hủy đơn bằng findOneAndUpdate để không hoàn quỹ 2 lần.
const TransferBooking = require('../models/TransferBooking');
const { releaseUse } = require('./couponService');
const VehicleInventory = require('../models/VehicleInventory');
const TransportCompany = require('../models/TransportCompany');
const VehicleType = require('../models/VehicleType');
const TransferRoute = require('../models/TransferRoute');

const HOLD_MINUTES = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const INITIAL_INVENTORY_DAYS = 60;

// 'YYYY-MM-DDTHH:mm' (giờ Việt Nam, từ ô datetime-local) -> Date thật
const parseVnDateTime = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Ngày đón theo giờ Việt Nam -> mốc 00:00 UTC (quy ước lưu quỹ xe, giống quỹ phòng)
const serviceDateOf = (pickupTime) => {
  const vn = new Date(pickupTime.getTime() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
};

// 'YYYY-MM-DD' -> mốc 00:00 UTC
const parseDateKey = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null);

const todayKey = () => serviceDateOf(new Date());

// Tạo sẵn quỹ xe cho N ngày tới (ngày nào có rồi thì giữ nguyên)
exports.createInitialInventory = async (vehicleType, days = INITIAL_INVENTORY_DAYS) => {
  const start = todayKey().getTime();
  const ops = Array.from({ length: days }, (_, i) => ({
    updateOne: {
      filter: { vehicleTypeId: vehicleType._id, date: new Date(start + i * DAY_MS) },
      update: { $setOnInsert: { availableVehicles: vehicleType.totalVehicles } },
      upsert: true
    }
  }));
  await VehicleInventory.bulkWrite(ops, { ordered: false });
};

// Trừ nguyên tử: chỉ trừ khi còn đủ xe trong ngày đó
exports.reserveVehicles = async (vehicleTypeId, date, quantity) => {
  const result = await VehicleInventory.updateOne(
    { vehicleTypeId, date, availableVehicles: { $gte: quantity } },
    { $inc: { availableVehicles: -quantity } }
  );
  return result.modifiedCount === 1;
};

exports.releaseVehicles = (booking) => VehicleInventory.updateOne(
  { vehicleTypeId: booking.vehicleTypeId, date: booking.serviceDate },
  { $inc: { availableVehicles: booking.vehicles } }
);

// Hủy đơn Pending + trả xe. Chỉ một tiến trình (khách hủy / cronjob) thắng nhờ điều kiện status.
exports.cancelPendingTransfer = async (filter) => {
  const booking = await TransferBooking.findOneAndUpdate(
    { ...filter, status: 'Pending' },
    { $set: { status: 'Canceled' }, $unset: { expiresAt: 1 } },
    { returnDocument: 'after' }
  );
  if (!booking) return null;
  await exports.releaseVehicles(booking);
  await releaseUse(booking.coupon?.couponId); // trả lượt mã giảm giá (nếu có)
  return booking;
};

exports.expiredPendingTransferFilter = (now = new Date()) => ({ status: 'Pending', expiresAt: { $lte: now } });

exports.HOLD_MINUTES = HOLD_MINUTES;
exports.DAY_MS = DAY_MS;
exports.parseVnDateTime = parseVnDateTime;
exports.serviceDateOf = serviceDateOf;
exports.parseDateKey = parseDateKey;
exports.todayKey = todayKey;

// Tuyến đang bán: nhà xe đã duyệt + loại xe đang hoạt động + tuyến đang hoạt động
const activeRoutes = async (filter = {}) => {
  const companies = await TransportCompany.find({ status: 'Approved' }).select('companyName phone').lean();
  const vehicles = await VehicleType.find({ companyId: { $in: companies.map((c) => c._id) }, isActive: { $ne: false } }).lean();
  const routes = await TransferRoute.find({ ...filter, isActive: { $ne: false }, vehicleTypeId: { $in: vehicles.map((v) => v._id) } }).lean();
  const companyById = new Map(companies.map((c) => [c._id.toString(), c]));
  const vehicleById = new Map(vehicles.map((v) => [v._id.toString(), v]));
  return routes.map((r) => ({ route: r, vehicle: vehicleById.get(r.vehicleTypeId.toString()), company: companyById.get(r.companyId.toString()) }));
};

// Lựa chọn xe còn đặt được (rẻ nhất trước). Dùng chung cho trang Xe đưa đón và chatbot.
//   province: tỉnh chuẩn (null = mọi tỉnh); date: mốc 00:00 UTC hoặc null (chưa chọn ngày -> không kiểm tra quỹ xe)
const findTransferOptions = async ({ province = null, date = null, passengers = 1 } = {}) => {
  const items = await activeRoutes(province ? { province } : {});
  let inventory = new Map();
  if (date) {
    const invs = await VehicleInventory.find({ vehicleTypeId: { $in: items.map((i) => i.vehicle._id) }, date }).lean();
    inventory = new Map(invs.map((inv) => [inv.vehicleTypeId.toString(), inv.availableVehicles]));
  }
  return items.map(({ route, vehicle, company }) => {
    const vehiclesNeeded = Math.ceil(passengers / vehicle.seats); // nhiều khách hơn số chỗ -> đặt nhiều xe
    const availableVehicles = date ? (inventory.get(vehicle._id.toString()) ?? 0) : null;
    return {
      routeId: route._id,
      province: route.province,
      fromPlace: route.fromPlace,
      toPlace: route.toPlace,
      durationMin: route.durationMin,
      price: route.price,
      vehiclesNeeded,
      totalPrice: route.price * vehiclesNeeded,
      availableVehicles,
      bookable: availableVehicles === null ? true : availableVehicles >= vehiclesNeeded,
      vehicle: { _id: vehicle._id, name: vehicle.name, seats: vehicle.seats, luggage: vehicle.luggage, amenities: vehicle.amenities, images: vehicle.images },
      company: { _id: company._id, companyName: company.companyName }
    };
  })
    .filter((x) => x.bookable)
    .sort((a, b) => a.totalPrice - b.totalPrice);
};

exports.activeRoutes = activeRoutes;
exports.findTransferOptions = findTransferOptions;
