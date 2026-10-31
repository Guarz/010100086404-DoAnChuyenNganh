// File: controllers/reviewController.js
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');

// Tính lại điểm trung bình + số lượt đánh giá và lưu vào Hotel
// (Hotel.rating được dùng để xếp hạng Top khách sạn nổi bật).
const recalculateHotelRating = async (hotelId) => {
  const [stats] = await Review.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    { $group: { _id: '$hotelId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);

  const rating = stats ? Math.round(stats.avgRating * 10) / 10 : 0;
  const reviewCount = stats ? stats.count : 0;

  await Hotel.updateOne({ _id: hotelId }, { $set: { rating, reviewCount } });
  return { rating, reviewCount };
};

// [POST] /api/reviews - Khách viết đánh giá cho 1 đơn đã hoàn thành
// Body: { bookingId, rating (1-5), comment }
exports.createReview = async (req, res) => {
  try {
    const { bookingId, comment } = req.body;
    const rating = Number(req.body.rating);

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: 'Mã đơn đặt phòng không hợp lệ' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Điểm đánh giá phải từ 1 đến 5 sao' });
    }
    const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
    if (trimmedComment.length < 5 || trimmedComment.length > 1000) {
      return res.status(400).json({ success: false, message: 'Nội dung đánh giá cần từ 5 đến 1000 ký tự' });
    }

    const booking = await Booking.findById(bookingId).select('customerId hotelId bookingStatus');
    if (!booking || booking.customerId.toString() !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt phòng' });
    }
    if (booking.bookingStatus !== 'Completed') {
      return res.status(400).json({ success: false, message: 'Bạn chỉ có thể đánh giá sau khi hoàn tất kỳ nghỉ' });
    }

    const review = await Review.create({
      customerId: req.user.id,
      hotelId: booking.hotelId,
      bookingId: booking._id,
      rating,
      comment: trimmedComment
    });

    const hotelStats = await recalculateHotelRating(booking.hotelId);

    return res.status(201).json({
      success: true,
      message: 'Cảm ơn bạn đã gửi đánh giá!',
      data: review,
      hotel: hotelStats
    });
  } catch (error) {
    // bookingId có unique index -> mỗi đơn chỉ được đánh giá 1 lần
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Bạn đã đánh giá đơn đặt phòng này rồi' });
    }
    console.error('Lỗi tạo đánh giá:', error);
    return res.status(500).json({ success: false, message: 'Không thể gửi đánh giá lúc này' });
  }
};

// [GET] /api/reviews/hotel/:hotelId - Danh sách đánh giá công khai của 1 khách sạn
exports.getHotelReviews = async (req, res) => {
  try {
    const { hotelId } = req.params;
    if (!mongoose.isValidObjectId(hotelId)) {
      return res.status(400).json({ success: false, message: 'Mã khách sạn không hợp lệ' });
    }

    const [reviews, distribution, hotel] = await Promise.all([
      Review.find({ hotelId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('customerId', 'fullName')
        .populate({
          path: 'bookingId',
          select: 'checkInDate bookingDetails.roomTypeId',
          populate: { path: 'bookingDetails.roomTypeId', select: 'title' }
        })
        .lean(),
      Review.aggregate([
        { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
        { $group: { _id: '$rating', count: { $sum: 1 } } }
      ]),
      Hotel.findById(hotelId).select('rating reviewCount')
    ]);

    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách sạn' });
    }

    const stars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach(({ _id, count }) => { stars[_id] = count; });

    // Chỉ trả về thông tin cần hiển thị, không lộ email / id khách
    const data = reviews.map((review) => ({
      _id: review._id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      customerName: review.customerId?.fullName || 'Khách Nestly',
      stayDate: review.bookingId?.checkInDate || null,
      roomTitles: (review.bookingId?.bookingDetails || [])
        .map((detail) => detail.roomTypeId?.title)
        .filter(Boolean)
    }));

    return res.status(200).json({
      success: true,
      summary: { rating: hotel.rating || 0, reviewCount: hotel.reviewCount || 0, stars },
      data
    });
  } catch (error) {
    console.error('Lỗi lấy đánh giá khách sạn:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải đánh giá lúc này' });
  }
};

exports.recalculateHotelRating = recalculateHotelRating;
