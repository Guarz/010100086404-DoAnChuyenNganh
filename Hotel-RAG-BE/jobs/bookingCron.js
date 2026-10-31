// File: jobs/bookingCron.js
// Các tác vụ chạy ngầm cho Booking:
//  1. Mỗi 1 phút: hủy đơn Pending quá 5 phút chưa thanh toán và hoàn availableRooms vào RoomInventory.
//  2. Mỗi ngày 00:05: chuyển đơn Confirmed đã qua ngày Check-out sang Completed (để khách có thể Review).
const cron = require('node-cron');
const Booking = require('../models/Booking');
const { cancelPendingBooking, expiredPendingFilter } = require('../services/inventoryService');

const TIMEZONE = 'Asia/Ho_Chi_Minh';
let isReleasing = false; // Chặn 2 lượt quét chồng lên nhau nếu lượt trước chạy lâu

const releaseExpiredBookings = async () => {
  if (isReleasing) return;
  isReleasing = true;

  try {
    const expired = await Booking.find(expiredPendingFilter()).select('_id').lean();
    let canceledCount = 0;

    for (const { _id } of expired) {
      try {
        // cancelPendingBooking tự kiểm tra lại trạng thái Pending, nên nếu khách vừa thanh toán
        // xong (VNPay đã chuyển sang Confirmed) thì đơn sẽ được bỏ qua.
        const canceled = await cancelPendingBooking({ _id });
        if (canceled) canceledCount++;
      } catch (error) {
        console.error(`[Cron] Lỗi hủy đơn ${_id}:`, error.message);
      }
    }

    if (canceledCount > 0) {
      console.log(`[Cron] Đã hủy ${canceledCount} đơn quá hạn thanh toán và hoàn quỹ phòng`);
    }
  } catch (error) {
    console.error('[Cron] Lỗi quét đơn quá hạn:', error.message);
  } finally {
    isReleasing = false;
  }
};

const completeFinishedStays = async () => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const result = await Booking.updateMany(
      { bookingStatus: 'Confirmed', checkOutDate: { $lte: startOfToday } },
      { $set: { bookingStatus: 'Completed' } }
    );

    if (result.modifiedCount > 0) {
      console.log(`[Cron] Đã chuyển ${result.modifiedCount} đơn sang Completed`);
    }
  } catch (error) {
    console.error('[Cron] Lỗi cập nhật đơn hoàn thành:', error.message);
  }
};

// Phiên bản cũ dùng TTL index trên expiresAt -> MongoDB tự xóa đơn Pending, làm mất quỹ phòng.
// Xóa index đó (nếu còn trong DB) để cronjob là nơi duy nhất xử lý đơn hết hạn.
const dropLegacyTtlIndex = async () => {
  try {
    const indexes = await Booking.collection.indexes();
    const ttlIndex = indexes.find((index) => index.key?.expiresAt && index.expireAfterSeconds !== undefined);
    if (ttlIndex) {
      await Booking.collection.dropIndex(ttlIndex.name);
      console.log(`[Cron] Đã xóa TTL index cũ: ${ttlIndex.name}`);
    }
  } catch (error) {
    // Collection chưa tồn tại -> không có gì để xóa
    if (error.codeName !== 'NamespaceNotFound') {
      console.error('[Cron] Không thể kiểm tra TTL index:', error.message);
    }
  }
};

const startBookingCron = async () => {
  await dropLegacyTtlIndex();

  cron.schedule('* * * * *', releaseExpiredBookings, { timezone: TIMEZONE, name: 'release-expired-bookings' });
  cron.schedule('5 0 * * *', completeFinishedStays, { timezone: TIMEZONE, name: 'complete-finished-stays' });

  // Chạy ngay 1 lần khi khởi động để dọn các đơn tồn đọng lúc server tắt
  await releaseExpiredBookings();
  await completeFinishedStays();

  console.log('[Cron] Đã khởi động tác vụ nền cho Booking');
};

module.exports = { startBookingCron, releaseExpiredBookings, completeFinishedStays };
