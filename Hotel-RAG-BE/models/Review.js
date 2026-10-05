// File: models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true }, // 1 Booking chỉ được đánh giá 1 lần
  
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);