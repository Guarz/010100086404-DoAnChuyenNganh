// File: models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  paymentMethod: {
    type: String,
    enum: ['VNPay', 'Momo', 'Cash'],
    required: true
  },
  amount: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Success', 'Failed'],
    default: 'Pending'
  },
  paymentDate: { type: Date } // Sẽ được cập nhật khi webhook VNPay trả về Success
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);