// File: services/transferService.js
// Giữ / trả xe đưa đón — cùng cơ chế với services/inventoryService.js của khách sạn:
// trừ nguyên tử theo điều kiện, hủy đơn bằng findOneAndUpdate để không hoàn quỹ 2 lần.
const TransferBooking = require('../models/TransferBooking');
const VehicleInventory = require('../models/VehicleInventory');

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
  return booking;
};

exports.expiredPendingTransferFilter = (now = new Date()) => ({ status: 'Pending', expiresAt: { $lte: now } });

exports.HOLD_MINUTES = HOLD_MINUTES;
exports.DAY_MS = DAY_MS;
exports.parseVnDateTime = parseVnDateTime;
exports.serviceDateOf = serviceDateOf;
exports.parseDateKey = parseDateKey;
exports.todayKey = todayKey;
