// File: controllers/partnerController.js
const Hotel = require("../models/Hotel");
const User = require("../models/User");
const mongoose = require("mongoose");
const RoomType = require("../models/RoomType");
const RoomInventory = require("../models/RoomInventory");
const Booking = require("../models/Booking");

exports.getApplicationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "role partnerApplicationStatus",
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tài khoản" });

    return res.status(200).json({
      success: true,
      data: {
        role: user.role,
        status: user.partnerApplicationStatus,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy trạng thái đăng ký partner:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải trạng thái đăng ký lúc này",
    });
  }
};

exports.applyForPartner = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tài khoản" });
    if (user.role === "Admin" || user.role === "Partner") {
      return res.status(409).json({
        success: false,
        message: "Tài khoản của bạn đã có quyền đối tác hoặc quản trị",
      });
    }
    if (user.partnerApplicationStatus === "Pending") {
      return res.status(409).json({
        success: false,
        message: "Yêu cầu của bạn đang chờ quản trị viên duyệt",
      });
    }

    user.partnerApplicationStatus = "Pending";
    await user.save();

    return res.status(201).json({
      success: true,
      message: "Đã gửi yêu cầu làm shop. Vui lòng chờ quản trị viên duyệt.",
      data: { status: user.partnerApplicationStatus },
    });
  } catch (error) {
    console.error("Lỗi gửi yêu cầu partner:", error);
    return res
      .status(500)
      .json({ success: false, message: "Không thể gửi yêu cầu lúc này" });
  }
};

exports.getPendingPartnerApplications = async (req, res) => {
  try {
    const users = await User.find({ partnerApplicationStatus: "Pending" })
      .select("fullName email phone createdAt partnerApplicationStatus")
      .sort({ createdAt: 1 });
    return res
      .status(200)
      .json({ success: true, count: users.length, data: users });
  } catch (error) {
    console.error("Lỗi lấy yêu cầu partner:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách yêu cầu partner",
    });
  }
};

exports.reviewPartnerApplication = async (req, res) => {
  try {
    const { decision } = req.params;
    if (!["approve", "reject"].includes(decision)) {
      return res
        .status(400)
        .json({ success: false, message: "Quyết định duyệt không hợp lệ" });
    }

    const user = await User.findOne({
      _id: req.params.userId,
      partnerApplicationStatus: "Pending",
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu đang chờ duyệt",
      });
    }

    user.partnerApplicationStatus =
      decision === "approve" ? "Approved" : "Rejected";
    if (decision === "approve") user.role = "Partner";
    await user.save();

    return res.status(200).json({
      success: true,
      message:
        decision === "approve"
          ? "Đã duyệt đối tác"
          : "Đã từ chối yêu cầu đối tác",
      data: {
        _id: user._id,
        fullName: user.fullName,
        role: user.role,
        status: user.partnerApplicationStatus,
      },
    });
  } catch (error) {
    console.error("Lỗi xét duyệt yêu cầu partner:", error);
    return res
      .status(500)
      .json({ success: false, message: "Không thể xét duyệt yêu cầu lúc này" });
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
      images, // Array string (URL ảnh)
    } = req.body;

    // 1. Validate dữ liệu cơ bản
    if (!hotelName || !address || !address.city) {
      return res.status(400).json({
        success: false,
        message:
          "Vui lòng cung cấp đủ thông tin bắt buộc (hotelName, address.city)",
      });
    }

    // 2. Tạo object Khách sạn mới
    const newHotel = new Hotel({
      partnerId: req.user.id,
      hotelName,
      description,
      address,
      // Nếu có tọa độ thì cấu hình chuẩn GeoJSON của MongoDB
      coordinates:
        coordinates && coordinates.length === 2
          ? {
              type: "Point",
              coordinates: coordinates,
            }
          : undefined,
      amenities: amenities || [],
      images: images || [],
      rating: 0, // Khách sạn mới chưa có đánh giá
      status: "Pending", // BẮT BUỘC ÉP KIỂU: Không cho Partner tự sửa thành Approved
      embedding: [], // Bỏ trống, chờ chạy AI script sau
    });

    // 3. Lưu vào Database
    await newHotel.save();

    res.status(201).json({
      success: true,
      message: "Tạo khách sạn thành công! Vui lòng chờ Admin phê duyệt.",
      data: newHotel,
    });
  } catch (error) {
    console.error("Lỗi khi tạo khách sạn:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi tạo khách sạn" });
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
      images,
    } = req.body;

    // Quyền sở hữu đã được requireHotelOwnership kiểm tra ở route (Partner chủ KS hoặc Admin)
    const hotel = req.hotel;

    if (hotel.status !== "Approved") {
      return res
        .status(400)
        .json({ success: false, message: "Khách sạn chưa được duyệt" });
    }

    if (!title || !basePrice || !totalQuantity) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đủ: title, basePrice, totalQuantity",
      });
    }

    // 5. Lưu RoomType vào DB
    const newRoomType = new RoomType({
      hotelId,
      title,
      description,
      basePrice,
      maxAdults: maxAdults || 2,
      maxChildren: maxChildren || 0,
      totalQuantity,
      amenities: amenities || [],
      images: images || [],
    });

    await newRoomType.save();

    // -----------------------------------------------------
    // PHẦN MỚI: TỰ ĐỘNG SINH QUỸ PHÒNG (INVENTORY) 30 NGÀY
    // -----------------------------------------------------
    const newInventories = [];
    // Dùng mốc 00:00 UTC giống updateInventory (new Date('YYYY-MM-DD')) và dữ liệu sẵn có,
    // tránh 1 đêm bị 2 bản ghi (00:00Z và 17:00Z) khi Partner chỉnh giá sau đó.
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

    for (let i = 0; i < 30; i++) {
      const targetDate = new Date(todayUtc + i * 24 * 60 * 60 * 1000);

      newInventories.push({
        roomTypeId: newRoomType._id, // Trỏ đúng ID của phòng vừa tạo
        date: targetDate,
        availableRooms: totalQuantity, // Mở bán full
        dynamicPrice: basePrice, // Lấy giá gốc
      });
    }

    // Lưu toàn bộ 30 ngày vào DB cực nhanh
    await RoomInventory.insertMany(newInventories);

    // 6. Trả về kết quả
    res.status(201).json({
      success: true,
      message: "Tạo hạng phòng thành công! Đã tự động mở bán cho 30 ngày tới.",
      data: newRoomType,
    });
  } catch (error) {
    console.error("Lỗi khi tạo RoomType:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi tạo phòng" });
  }
};
// [PUT] /api/partner/inventory/:inventoryId - Partner cập nhật giá/số lượng
// Đảm bảo ở đầu file đã có: const RoomInventory = require('../models/RoomInventory');

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

exports.updateInventory = async (req, res) => {
  try {
    // Quyền sở hữu hạng phòng đã được requireRoomOwnership kiểm tra -> req.room
    const room = req.room;
    const { startDate, endDate, newPrice, newQuantity } = req.body;

    if (!DATE_ONLY.test(startDate || "") || !DATE_ONLY.test(endDate || "")) {
      return res
        .status(400)
        .json({ success: false, message: "Ngày phải có dạng YYYY-MM-DD." });
    }

    // Quỹ phòng lưu theo mốc 00:00 UTC của từng ngày
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res
        .status(400)
        .json({ success: false, message: "Ngày bắt đầu không hợp lệ." });
    }
    if ((end - start) / (24 * 60 * 60 * 1000) > 365) {
      return res
        .status(400)
        .json({ success: false, message: "Chỉ cập nhật tối đa 1 năm mỗi lần." });
    }

    const updateFields = {};
    if (newPrice !== "" && newPrice !== undefined) {
      const price = Number(newPrice);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ success: false, message: "Giá phải lớn hơn 0." });
      }
      updateFields.dynamicPrice = price;
    }
    if (newQuantity !== "" && newQuantity !== undefined) {
      const quantity = Number(newQuantity);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > room.totalQuantity) {
        return res.status(400).json({
          success: false,
          message: `Số phòng trống phải là số nguyên từ 0 đến ${room.totalQuantity}.`,
        });
      }
      updateFields.availableRooms = quantity;
    }

    if (Object.keys(updateFields).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng nhập thông tin mới." });
    }

    // Tạo mảng lưu danh sách các ngày khách chọn
    const dateArray = [];
    let currentDate = new Date(start);
    while (currentDate <= end) {
      dateArray.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Dùng bulkWrite để UPSERT (Ngày nào có rồi thì Sửa, chưa có thì Tạo mới)
    // Ngày mới tạo mà chỉ đổi giá thì mở bán đủ tổng số phòng (availableRooms là trường bắt buộc)
    const setOnInsert =
      updateFields.availableRooms === undefined
        ? { availableRooms: room.totalQuantity }
        : {};
    const bulkOps = dateArray.map((date) => ({
      updateOne: {
        filter: { roomTypeId: room._id, date: date },
        update: { $set: updateFields, $setOnInsert: setOnInsert },
        upsert: true, // <-- "Chìa khóa" giúp tự động tạo mới quỹ phòng
      },
    }));

    await RoomInventory.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: `Đã cập nhật/tạo mới thành công quỹ phòng cho ${dateArray.length} ngày!`,
    });
  } catch (error) {
    console.error("Lỗi cập nhật quỹ phòng:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi xử lý dữ liệu." });
  }
};
exports.getMyHotels = async (req, res) => {
  try {
    // Tìm các KS có partnerId khớp với ID của user đang đăng nhập
    const hotels = await Hotel.find({ partnerId: req.user.id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({ success: true, data: hotels });
  } catch (error) {
    console.error("Lỗi lấy danh sách khách sạn của Partner:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
exports.toggleRoomStatus = async (req, res) => {
  try {
    // Quyền sở hữu đã được requireRoomOwnership kiểm tra -> req.room
    const room = req.room;

    // Đảo ngược trạng thái: Đang true thành false, đang false thành true
    room.isActive = room.isActive === false ? true : false;
    await room.save();

    res.status(200).json({
      success: true,
      isActive: room.isActive,
      message: room.isActive
        ? "Đã mở bán phòng thành công!"
        : "Đã khóa phòng bảo trì!",
    });
  } catch (error) {
    console.error("Lỗi khóa phòng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
exports.checkInventory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!DATE_ONLY.test(startDate || "") || !DATE_ONLY.test(endDate || "")) {
      return res
        .status(400)
        .json({ success: false, message: "Ngày phải có dạng YYYY-MM-DD." });
    }

    const inventories = await RoomInventory.find({
      roomTypeId: req.room._id,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    }).sort("date");

    res.status(200).json({ success: true, data: inventories });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

// =====================================================
// QUẢN LÝ ĐƠN ĐẶT PHÒNG CỦA PARTNER
// =====================================================

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// [GET] /api/partner/bookings?hotelId=&status=&from=&to=
// Trả về đơn của các khách sạn thuộc Partner + thống kê nhanh để chuẩn bị buồng.
exports.getPartnerBookings = async (req, res) => {
  try {
    const { hotelId, status } = req.query;

    // 1. Xác định danh sách khách sạn được phép xem (Admin xem tất cả)
    const hotelFilter = req.user.role === "Admin" ? {} : { partnerId: req.user.id };
    if (hotelId) {
      if (!mongoose.isValidObjectId(hotelId)) {
        return res.status(400).json({ success: false, message: "Mã khách sạn không hợp lệ" });
      }
      hotelFilter._id = hotelId;
    }
    const hotels = await Hotel.find(hotelFilter).select("_id hotelName");
    const hotelIds = hotels.map((h) => h._id);

    if (hotelId && hotelIds.length === 0) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xem đơn của khách sạn này" });
    }

    // 2. Lọc trạng thái. Mặc định bỏ qua đơn Pending (chưa thanh toán, có thể tự hủy sau 5 phút)
    const allowedStatus = ["Pending", "Confirmed", "Canceled", "Completed"];
    const statusFilter =
      status && status !== "all"
        ? status.split(",").filter((s) => allowedStatus.includes(s))
        : ["Confirmed", "Completed", "Canceled"];

    const bookings = await Booking.find({
      hotelId: { $in: hotelIds },
      bookingStatus: { $in: statusFilter },
    })
      .sort({ checkInDate: 1 })
      .populate("customerId", "fullName email phone")
      .populate("hotelId", "hotelName")
      .populate("bookingDetails.roomTypeId", "title")
      .lean();

    // 3. Thống kê vận hành (chỉ tính đơn Confirmed - đơn đã thanh toán, khách sẽ đến)
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const summary = {
      arrivalsToday: 0,
      departuresToday: 0,
      inHouse: 0,
      upcoming7Days: 0,
      roomsToPrepareToday: 0,
      bookingsThisMonth: 0,
      revenueThisMonth: 0,
    };

    for (const b of bookings) {
      const checkIn = new Date(b.checkInDate);
      const checkOut = new Date(b.checkOutDate);
      const rooms = b.bookingDetails.reduce((sum, d) => sum + d.quantity, 0);

      if (b.bookingStatus !== "Canceled" && new Date(b.createdAt) >= monthStart) {
        summary.bookingsThisMonth++;
        summary.revenueThisMonth += b.totalAmount;
      }

      if (b.bookingStatus !== "Confirmed") continue;

      if (checkIn >= today && checkIn < tomorrow) {
        summary.arrivalsToday++;
        summary.roomsToPrepareToday += rooms;
      }
      if (checkOut >= today && checkOut < tomorrow) summary.departuresToday++;
      if (checkIn < today && checkOut > today) summary.inHouse++;
      if (checkIn >= today && checkIn < nextWeek) summary.upcoming7Days++;
    }

    return res.status(200).json({
      success: true,
      count: bookings.length,
      summary,
      hotels,
      data: bookings,
    });
  } catch (error) {
    console.error("Lỗi lấy đơn đặt phòng của Partner:", error);
    return res.status(500).json({ success: false, message: "Không thể tải danh sách đơn đặt phòng" });
  }
};

// [PUT] /api/partner/bookings/:id/complete - Xác nhận khách đã trả phòng (Confirmed -> Completed)
exports.completePartnerBooking = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Mã đơn không hợp lệ" });
    }

    const booking = await Booking.findById(id).populate("hotelId", "partnerId");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn đặt phòng" });
    }

    if (req.user.role !== "Admin" && booking.hotelId?.partnerId?.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền xử lý đơn này" });
    }

    if (booking.bookingStatus !== "Confirmed") {
      return res.status(400).json({ success: false, message: "Chỉ đơn đã thanh toán mới có thể xác nhận trả phòng" });
    }

    if (startOfDay(booking.checkInDate) > startOfDay(new Date())) {
      return res.status(400).json({ success: false, message: "Khách chưa đến ngày nhận phòng" });
    }

    booking.bookingStatus = "Completed";
    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Đã xác nhận khách trả phòng. Khách có thể viết đánh giá.",
      data: { _id: booking._id, bookingStatus: booking.bookingStatus },
    });
  } catch (error) {
    console.error("Lỗi xác nhận trả phòng:", error);
    return res.status(500).json({ success: false, message: "Không thể cập nhật đơn lúc này" });
  }
};
