// File: controllers/partnerController.js
const Hotel = require('../models/Hotel');
const mongoose = require('mongoose');
const RoomType = require('../models/RoomType');
const RoomInventory = require('../models/RoomInventory');

// [POST] /api/partner/hotels - Partner tạo khách sạn mới
exports.createHotel = async (req, res) => {
  try {
    const {
      partnerId, // ID của chủ khách sạn (sau này lấy từ Token)
      hotelName,
      description,
      address, // Object: { street, city, province }
      coordinates, // Array: [lng, lat]
      amenities, // Array string
      images // Array string (URL ảnh)
    } = req.body;

    // 1. Validate dữ liệu cơ bản
    if (!partnerId || !hotelName || !address || !address.city) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng cung cấp đủ thông tin bắt buộc (partnerId, hotelName, address.city)' 
      });
    }

    // 2. Tạo object Khách sạn mới
    const newHotel = new Hotel({
      partnerId,
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
      partnerId, 
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
    
    if (hotel.partnerId.toString() !== partnerId) {
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
    const { partnerId, dynamicPrice, availableRooms } = req.body;

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
    if (inventory.roomTypeId.hotelId.partnerId.toString() !== partnerId) {
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