// File: controllers/hotelController.js
const Hotel = require("../models/Hotel");
const RoomInventory = require("../models/RoomInventory");
const RoomType = require("../models/RoomType");
const mongoose = require("mongoose");

exports.getAllHotels = async (req, res) => {
  try {
    const hotels = await Hotel.find({ status: "Approved" }).select(
      "-embedding",
    ); // Ẩn mảng số dài cho nhẹ
    res.status(200).json({ success: true, data: hotels });
  } catch (error) {
    console.error("Lỗi lấy danh sách KS:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// [GET] /api/hotels/:id - Lấy chi tiết 1 khách sạn
exports.getHotelById = async (req, res) => {
  try {
    const hotelId = req.params.id;
    const hotel = await Hotel.findById(hotelId).select("-embedding"); // Lấy thông tin, giấu mảng số đi

    if (!hotel) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy khách sạn" });
    }
    res.status(200).json({ success: true, data: hotel });
  } catch (error) {
    console.error("Lỗi lấy chi tiết KS:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.getRoomsByHotel = async (req, res) => {
  try {
    const { showAll, checkIn, checkOut } = req.query;
    const filter = { hotelId: req.params.id };

    if (showAll !== "true") {
      filter.isActive = { $ne: false };
    }

    // Lấy danh sách hạng phòng gốc (.lean() để biến Mongoose Document thành Object thường)
    let rooms = await RoomType.find(filter).lean();

    // NẾU CÓ TRUYỀN NGÀY (Từ trang Hotel Detail), ĐỌC GIÁ DYNAMIC TỪ QUỸ PHÒNG
    if (checkIn && checkOut && showAll !== "true") {
      const startDate = new Date(checkIn);
      const endDate = new Date(checkOut);

      rooms = await Promise.all(
        rooms.map(async (room) => {
          const inventories = await RoomInventory.find({
            roomTypeId: room._id,
            date: { $gte: startDate, $lt: endDate },
          });

          if (inventories.length > 0) {
            // Lấy giá đêm đầu tiên làm giá hiển thị đại diện
            room.dynamicPrice = inventories[0].dynamicPrice;
            // Tìm số phòng trống ít nhất trong chuỗi ngày khách ở
            room.availableRooms = Math.min(
              ...inventories.map((inv) => inv.availableRooms),
            );
          } else {
            room.availableRooms = 0; // Hết quỹ phòng
          }
          return room;
        }),
      );

      // Ẩn luôn các phòng đã hết trống trong giai đoạn khách chọn
      rooms = rooms.filter((room) => room.availableRooms > 0);
    }

    res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    console.error("Lỗi lấy danh sách phòng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.searchHotels = async (req, res) => {
  try {
    const { city, checkIn, checkOut, adults, children } = req.query;

    const hotelFilter = { status: "Approved" };
    if (city) {
      hotelFilter["address.city"] = new RegExp(city, "i"); // Regex không phân biệt hoa thường
    }

    let hotels = await Hotel.aggregate([
      { $match: hotelFilter },
      {
        $lookup: {
          from: "roomtypes",
          localField: "_id",
          foreignField: "hotelId",
          as: "roomTypes",
        },
      },
      { $project: { embedding: 0 } },
    ]);

    const requiredAdults = parseInt(adults) || 1;
    const requiredChildren = parseInt(children) || 0;

    hotels.forEach((hotel) => {
      hotel.roomTypes = hotel.roomTypes.filter(
        (rt) =>
          rt.isActive !== false && // <-- THÊM DÒNG NÀY ĐỂ CHẶN PHÒNG BẢO TRÌ
          rt.maxAdults >= requiredAdults &&
          rt.maxChildren >= requiredChildren,
      );
    });

    hotels = hotels.filter((hotel) => hotel.roomTypes.length > 0);

    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      const totalNights = Math.ceil(
        (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24),
      );
      const roomTypeIds = hotels.flatMap((h) =>
        h.roomTypes.map((rt) => rt._id),
      );

      const inventories = await RoomInventory.find({
        roomTypeId: { $in: roomTypeIds },
        date: { $gte: checkInDate, $lt: checkOutDate }, // Lấy các ngày từ CheckIn đến trước CheckOut
      });

      hotels.forEach((hotel) => {
        hotel.roomTypes = hotel.roomTypes.filter((rt) => {
          const rtInventories = inventories.filter(
            (inv) => inv.roomTypeId.toString() === rt._id.toString(),
          );

          if (rtInventories.length < totalNights) return false;

          const isAvailable = rtInventories.every(
            (inv) => inv.availableRooms > 0,
          );
          return isAvailable;
        });
      });

      hotels = hotels.filter((hotel) => hotel.roomTypes.length > 0);
    }

    res.status(200).json({ success: true, count: hotels.length, data: hotels });
  } catch (error) {
    console.error("Lỗi searchHotels:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi tìm kiếm" });
  }
};
