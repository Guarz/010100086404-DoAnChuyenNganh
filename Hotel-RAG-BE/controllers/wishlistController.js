// File: controllers/wishlistController.js
// Danh sách khách sạn yêu thích của người đang đăng nhập (mọi vai trò).
const mongoose = require('mongoose');
const User = require('../models/User');
const Hotel = require('../models/Hotel');

const MAX_WISHLIST = 200;

// [GET] /api/users/me/wishlist -> { ids, hotels } (chỉ khách sạn còn hoạt động)
exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('wishlist').lean();
    const hotels = await Hotel.find({ _id: { $in: user?.wishlist || [] }, status: 'Approved' })
      .select('hotelName address images rating reviewCount amenities')
      .lean();
    // Giữ thứ tự: mới thêm nằm đầu
    const order = new Map((user?.wishlist || []).map((id, i) => [id.toString(), i]));
    hotels.sort((a, b) => order.get(b._id.toString()) - order.get(a._id.toString()));
    return res.status(200).json({ success: true, ids: hotels.map((h) => h._id), data: hotels });
  } catch (error) {
    console.error('Lỗi tải danh sách yêu thích:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách yêu thích' });
  }
};

// [POST] /api/users/me/wishlist/:hotelId
exports.addToWishlist = async (req, res) => {
  const { hotelId } = req.params;
  if (!mongoose.isValidObjectId(hotelId)) {
    return res.status(400).json({ success: false, message: 'Mã khách sạn không hợp lệ' });
  }
  try {
    if (!(await Hotel.exists({ _id: hotelId, status: 'Approved' }))) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách sạn' });
    }
    // $addToSet: bấm nhiều lần cũng không trùng; giới hạn số lượng để tránh lạm dụng
    const result = await User.updateOne(
      { _id: req.user.id, [`wishlist.${MAX_WISHLIST - 1}`]: { $exists: false } },
      { $addToSet: { wishlist: hotelId } }
    );
    if (!result.matchedCount) {
      return res.status(400).json({ success: false, message: `Danh sách yêu thích tối đa ${MAX_WISHLIST} khách sạn` });
    }
    return res.status(200).json({ success: true, message: 'Đã thêm vào danh sách yêu thích' });
  } catch (error) {
    console.error('Lỗi thêm yêu thích:', error);
    return res.status(500).json({ success: false, message: 'Không thể thêm vào danh sách yêu thích' });
  }
};

// [DELETE] /api/users/me/wishlist/:hotelId
exports.removeFromWishlist = async (req, res) => {
  const { hotelId } = req.params;
  if (!mongoose.isValidObjectId(hotelId)) {
    return res.status(400).json({ success: false, message: 'Mã khách sạn không hợp lệ' });
  }
  try {
    await User.updateOne({ _id: req.user.id }, { $pull: { wishlist: hotelId } });
    return res.status(200).json({ success: true, message: 'Đã bỏ khỏi danh sách yêu thích' });
  } catch (error) {
    console.error('Lỗi bỏ yêu thích:', error);
    return res.status(500).json({ success: false, message: 'Không thể bỏ khỏi danh sách yêu thích' });
  }
};
