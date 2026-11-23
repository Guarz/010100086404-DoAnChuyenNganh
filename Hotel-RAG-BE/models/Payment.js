// File: models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Thanh toán cho đơn phòng HOẶC đơn xe đưa đón (đúng một trong hai)
  bookingId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'Booking',
    required: function () { return !this.transferBookingId; }
  },
  transferBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransferBooking' },
  paymentMethod: {
    type: String,
    enum: ['VNPay', 'Momo', 'Cash', 'Demo'],
    required: true
  },
  amount: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Success', 'Failed'],
    default: 'Pending'
  },
  paymentDate: { type: Date }, // Cập nhật khi cổng thanh toán trả về Success
  transactionId: { type: String } // Mã giao dịch của cổng thanh toán (vnp_TransactionNo / transId MoMo) để đối soát
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);