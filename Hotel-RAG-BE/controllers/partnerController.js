// File: controllers/partnerController.js
const Hotel = require('../models/Hotel');
const User = require('../models/User');
const mongoose = require('mongoose');
const RoomType = require('../models/RoomType');
const RoomInventory = require('../models/RoomInventory');

exports.getApplicationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('role partnerApplicationStatus');
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });

    return res.status(200).json({
      success: true,
      data: {
        role: user.role,
        status: user.partnerApplicationStatus
      }
    });
  } catch (error) {
    console.error('Lỗi lấy trạng thái đăng ký partner:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải trạng thái đăng ký lúc này' });
  }
};

exports.applyForPartner = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    if (user.role === 'Admin' || user.role === 'Partner') {
      return res.status(409).json({ success: false, message: 'Tài khoản của bạn đã có quyền đối tác hoặc quản trị' });
    }
    if (user.partnerApplicationStatus === 'Pending') {
      return res.status(409).json({ success: false, message: 'Yêu cầu của bạn đang chờ quản trị viên duyệt' });
    }

    user.partnerApplicationStatus = 'Pending';
    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Đã gửi yêu cầu làm shop. Vui lòng chờ quản trị viên duyệt.',
      data: { status: user.partnerApplicationStatus }
    });
  } catch (error) {
    console.error('Lỗi gửi yêu cầu partner:', error);
    return res.status(500).json({ success: false, message: 'Không thể gửi yêu cầu lúc này' });
  }
};

exports.getPendingPartnerApplications = async (req, res) => {
  try {
    const users = await User.find({ partnerApplicationStatus: 'Pending' })
      .select('fullName email phone createdAt partnerApplicationStatus')
      .sort({ createdAt: 1 });
    return res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    console.error('Lỗi lấy yêu cầu partner:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách yêu cầu partner' });
  }
};

exports.reviewPartnerApplication = async (req, res) => {
  try {
    const { decision } = req.params;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Quyết định duyệt không hợp lệ' });
    }

    const user = await User.findOne({
      _id: req.params.userId,
      partnerApplicationStatus: 'Pending'
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đang chờ duyệt' });
    }

    user.partnerApplicationStatus = decision === 'approve' ? 'Approved' : 'Rejected';
    if (decision === 'approve') user.role = 'Partner';
    await user.save();

    return res.status(200).json({
      success: true,
      message: decision === 'approve' ? 'Đã duyệt đối tác' : 'Đã từ chối yêu cầu đối tác',
      data: {
        _id: user._id,
        fullName: user.fullName,
        role: user.role,
        status: user.partnerApplicationStatus
      }
    });
  } catch (error) {
    console.error('Lỗi xét duyệt yêu cầu partner:', error);
    return res.status(500).json({ success: false, message: 'Không thể xét duyệt yêu cầu lúc này' });
  }
};

// [POST] /api/partner/hotels - Partner tạo khách sạn mới
exports.createHotel = async (req, res) => {
  try {
    const {
      hotelName,
      description,
      address, // Object: { street, city, province }
      coordinates, // Array: [lng, lat]
      amenities, // Array string
      images // Array string (URL ảnh)
    } = req.body;

    // 1. Validate dữ liệu cơ bản
    if (!hotelName || !address || !address.city) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng cung cấp đủ thông tin bắt buộc (hotelName, address.city)'
      });
    }

    // 2. Tạo object Khách sạn mới
    const newHotel = new Hotel({
      partnerId: req.user.id,
      hotelName,
      description,
      address,
      // Nếu có tọa độ thì cấu hình chuẩn GeoJSON của MongoDB
      coordinates: coordinates && coordinates.length === 2 ? {
        type: 'Point',
        coordinates: coordinates
      } : undefined,
      amenities: amenities || [],
      images: images || [],
      rating: 0, // Khách sạn mới chưa có đánh giá
      status: 'Pending', // BẮT BUỘC ÉP KIỂU: Không cho Partner tự sửa thành Approved
      embedding: [] // Bỏ trống, chờ chạy AI script sau
    });

    // 3. Lưu vào Database
    await newHotel.save();

    res.status(201).json({
      success: true,
      message: 'Tạo khách sạn thành công! Vui lòng chờ Admin phê duyệt.',
      data: newHotel
    });

  } catch (error) {
    console.error("Lỗi khi tạo khách sạn:", error);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo khách sạn' });
  }
};
exports.createRoomType = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const {
      title,
      description,
      basePrice,
      maxAdults,
      maxChildren,
      totalQuantity,
      amenities,
      images
    } = req.body;

    // 1 & 2 & 3 & 4. Validate và Bảo mật (Giữ nguyên như cũ)
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) return res.status(404).json({ success: false, message: 'Không tìm thấy khách sạn' });
    
    if (hotel.partnerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thêm phòng vào khách sạn này' });
    }
    
    if (hotel.status !== 'Approved') {
      return res.status(400).json({ success: false, message: 'Khách sạn chưa được duyệt' });
    }

    if (!title || !basePrice || !totalQuantity) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ: title, basePrice, totalQuantity' });
    }

    // 5. Lưu RoomType vào DB
    const newRoomType = new RoomType({
      hotelId, title, description, basePrice,
      maxAdults: maxAdults || 2, maxChildren: maxChildren || 0,
      totalQuantity, amenities: amenities || [], images: images || []
    });

    await newRoomType.save();

    // -----------------------------------------------------
    // PHẦN MỚI: TỰ ĐỘNG SINH QUỸ PHÒNG (INVENTORY) 30 NGÀY
    // -----------------------------------------------------
    const newInventories = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);

      newInventories.push({
        hotelId: hotelId,
        roomTypeId: newRoomType._id, // Trỏ đúng ID của phòng vừa tạo
        date: targetDate,
        totalRooms: totalQuantity,
        availableRooms: totalQuantity, // Mở bán full
        dynamicPrice: basePrice // Lấy giá gốc
      });
    }

    // Lưu toàn bộ 30 ngày vào DB cực nhanh
    await RoomInventory.insertMany(newInventories);

    // 6. Trả về kết quả
    res.status(201).json({
      success: true,
      message: 'Tạo hạng phòng thành công! Đã tự động mở bán cho 30 ngày tới.',
      data: newRoomType
    });

  } catch (error) {
    console.error("Lỗi khi tạo RoomType:", error);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo phòng' });
  }
};
// [PUT] /api/partner/inventory/:inventoryId - Partner cập nhật giá/số lượng
exports.updateInventory = async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { dynamicPrice, availableRooms } = req.body;

    // 1. MỚI: Truy xuất lồng nhau (Inventory -> RoomType -> Hotel)
    const inventory = await RoomInventory.findById(inventoryId).populate({
      path: 'roomTypeId',
      populate: {
        path: 'hotelId'
      }
    });

    if (!inventory) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin quỹ phòng ngày này' });
    }

    // 2. MỚI: Kiểm tra bảo mật qua chuỗi liên kết
    if (inventory.roomTypeId.hotelId.partnerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa quỹ phòng của khách sạn này' });
    }

    // ... (Phần 3 và 4 giữ nguyên như cũ) ...
    const updateData = {};
    if (dynamicPrice !== undefined) {
        if (dynamicPrice < 0) return res.status(400).json({ success: false, message: 'Giá không hợp lệ' });
        updateData.dynamicPrice = dynamicPrice;
    }
    if (availableRooms !== undefined) {
          if (availableRooms < 0 || availableRooms > inventory.totalRooms) {
              return res.status(400).json({ success: false, message: `Số lượng phòng mở bán phải từ 0 đến ${inventory.totalRooms}` });
          }
          updateData.availableRooms = availableRooms;
    }

    const updatedInventory = await RoomInventory.findByIdAndUpdate(
        inventoryId, updateData, { new: true }
    );

    res.status(200).json({ success: true, message: 'Cập nhật quỹ phòng thành công', data: updatedInventory });

  } catch (error) {
    console.error("Lỗi khi cập nhật Inventory:", error);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật quỹ phòng' });
  }
};
exports.getMyHotels = async (req, res) => {
  try {
    // Tìm các KS có partnerId khớp với ID của user đang đăng nhập
    const hotels = await Hotel.find({ partnerId: req.user.id }).sort({ createdAt: -1 });
    
    return res.status(200).json({ success: true, data: hotels });
  } catch (error) {
    console.error("Lỗi lấy danh sách khách sạn của Partner:", error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};