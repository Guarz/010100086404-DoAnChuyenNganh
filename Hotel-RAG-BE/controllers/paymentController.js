const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

exports.payBookingDemo = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.bookingId)) {
    return res.status(400).json({ success: false, message: 'Mã đặt phòng không hợp lệ' });
  }

  let session;
  try {
    session = await mongoose.startSession();
    let result;

    await session.withTransaction(async () => {
      const booking = await Booking.findOne({
        _id: req.params.bookingId,
        customerId: req.user.id
      }).session(session);

      if (!booking) {
        const error = new Error('Không tìm thấy đơn đặt phòng');
        error.statusCode = 404;
        throw error;
      }

      if (booking.bookingStatus === 'Confirmed') {
        const existingPayment = await Payment.findOne({
          bookingId: booking._id,
          paymentStatus: 'Success'
        }).session(session);

        if (existingPayment) {
          result = { booking, payment: existingPayment, alreadyPaid: true };
          return;
        }
      }

      if (booking.bookingStatus !== 'Pending') {
        const error = new Error('Đơn đặt phòng này không thể thanh toán');
        error.statusCode = 409;
        throw error;
      }

      let payment = await Payment.findOne({ bookingId: booking._id }).session(session);
      if (!payment) {
        payment = new Payment({ bookingId: booking._id });
      }

      payment.paymentMethod = 'Demo';
      payment.amount = booking.totalAmount;
      payment.paymentStatus = 'Success';
      payment.paymentDate = new Date();
      await payment.save({ session });

      booking.bookingStatus = 'Confirmed';
      await booking.save({ session });

      result = { booking, payment, alreadyPaid: false };
    });

    return res.status(200).json({
      success: true,
      message: result.alreadyPaid
        ? 'Đơn đặt phòng này đã được thanh toán demo trước đó'
        : 'Thanh toán demo thành công. Không có khoản tiền thật nào được thu.',
      data: {
        bookingId: result.booking._id,
        bookingStatus: result.booking.bookingStatus,
        payment: {
          _id: result.payment._id,
          paymentMethod: result.payment.paymentMethod,
          paymentStatus: result.payment.paymentStatus,
          amount: result.payment.amount,
          paymentDate: result.payment.paymentDate
        }
      }
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    console.error('Lỗi thanh toán demo:', error);
    return res.status(500).json({ success: false, message: 'Không thể xử lý thanh toán demo lúc này' });
  } finally {
    if (session) await session.endSession();
  }
};
