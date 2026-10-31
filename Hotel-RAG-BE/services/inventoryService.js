// File: services/inventoryService.js
// Gom toàn bộ logic trừ / hoàn quỹ phòng vào một chỗ để Booking, Cronjob và VNPay dùng chung.
const Booking = require('../models/Booking');
const RoomInventory = require('../models/RoomInventory');

const BOOKING_HOLD_MINUTES = 5;

// Giữ chỗ: trừ availableRooms cho từng đêm [checkIn, checkOut).
// Mỗi đêm được trừ bằng điều kiện nguyên tử (availableRooms >= quantity) nên 2 khách đặt cùng lúc
// không thể làm quỹ phòng âm. Nếu một đêm bất kỳ thất bại thì hoàn lại các đêm đã trừ.
exports.reserveInventory = async (details, checkIn, checkOut) => {
  const reserved = []; // [{ inventoryId, quantity }]

  try {
    for (const { roomTypeId, quantity, title } of details) {
      const inventories = await RoomInventory.find({
        roomTypeId,
        date: { $gte: checkIn, $lt: checkOut }
      }).select('_id date').sort('date');

      for (const inv of inventories) {
        const result = await RoomInventory.updateOne(
          { _id: inv._id, availableRooms: { $gte: quantity } },
          { $inc: { availableRooms: -quantity } }
        );

        if (result.modifiedCount === 0) {
          throw new Error(`Phòng ${title} vừa hết chỗ vào ngày ${inv.date.toLocaleDateString('vi-VN')}`);
        }
        reserved.push({ inventoryId: inv._id, quantity });
      }
    }
  } catch (error) {
    await Promise.all(reserved.map(({ inventoryId, quantity }) =>
      RoomInventory.updateOne({ _id: inventoryId }, { $inc: { availableRooms: quantity } })
    ));
    throw error;
  }
};

// Hoàn quỹ phòng của một booking (cộng lại availableRooms cho từng đêm).
exports.releaseInventory = async (booking) => {
  for (const detail of booking.bookingDetails) {
    const roomTypeId = detail.roomTypeId?._id || detail.roomTypeId;
    await RoomInventory.updateMany(
      { roomTypeId, date: { $gte: booking.checkInDate, $lt: booking.checkOutDate } },
      { $inc: { availableRooms: detail.quantity } }
    );
  }
};

// Hủy một đơn Pending và trả quỹ phòng.
// findOneAndUpdate với điều kiện bookingStatus = 'Pending' đảm bảo chỉ MỘT tiến trình
// (khách tự hủy, cronjob, hay trang Checkout) thắng cuộc đua -> quỹ phòng không bị hoàn 2 lần.
exports.cancelPendingBooking = async (filter) => {
  const booking = await Booking.findOneAndUpdate(
    { ...filter, bookingStatus: 'Pending' },
    { $set: { bookingStatus: 'Canceled' }, $unset: { expiresAt: 1 } },
    { new: true }
  );

  if (!booking) return null;

  await exports.releaseInventory(booking);
  return booking;
};

// Điều kiện "đơn Pending đã quá hạn thanh toán".
// Đơn cũ tạo trước khi có trường expiresAt thì tính theo createdAt + 5 phút.
exports.expiredPendingFilter = (now = new Date()) => ({
  bookingStatus: 'Pending',
  $or: [
    { expiresAt: { $lte: now } },
    {
      expiresAt: { $exists: false },
      createdAt: { $lte: new Date(now.getTime() - BOOKING_HOLD_MINUTES * 60 * 1000) }
    }
  ]
});

exports.BOOKING_HOLD_MINUTES = BOOKING_HOLD_MINUTES;
