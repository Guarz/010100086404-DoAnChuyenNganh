// File: controllers/hotelController.js
const Hotel = require("../models/Hotel");
const RoomInventory = require("../models/RoomInventory");
const RoomType = require("../models/RoomType");
const mongoose = require("mongoose");
const { CATALOG, amenityHaystack, hasAllAmenities, catalogEntry } = require("../services/amenityCatalog");

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

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Danh sách tiện nghi chọn lọc: ?amenities=Hồ bơi,Spa (nhãn chuẩn trong services/amenityCatalog.js)
const parseAmenityParam = (value) =>
  String(value || "")
    .split(",")
    .map((label) => label.trim())
    .filter((label) => catalogEntry(label));

// [GET] /api/hotels/search?city=&checkIn=&checkOut=&adults=&children=&rooms=&amenities=
exports.searchHotels = async (req, res) => {
  try {
    const { city, checkIn, checkOut, adults, children, rooms } = req.query;
    const amenities = parseAmenityParam(req.query.amenities);

    const hotelFilter = { status: "Approved" };
    if (city && String(city).trim()) {
      // Escape ký tự đặc biệt: khách gõ "(" không làm hỏng truy vấn
      hotelFilter["address.city"] = new RegExp(escapeRegex(String(city).trim()), "i");
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
    const requiredRooms = Math.max(parseInt(rooms) || 1, 1);

    // Tiện nghi xét trên TOÀN BỘ hạng phòng đang bán của khách sạn (trước khi lọc theo số khách)
    if (amenities.length) {
      hotels = hotels.filter((hotel) =>
        hasAllAmenities(
          amenityHaystack(hotel, hotel.roomTypes.filter((rt) => rt.isActive !== false)),
          amenities,
        ),
      );
    }

    hotels.forEach((hotel) => {
      hotel.roomTypes = hotel.roomTypes.filter(
        (rt) =>
          rt.isActive !== false && // <-- THÊM DÒNG NÀY ĐỂ CHẶN PHÒNG BẢO TRÌ
          rt.maxAdults >= requiredAdults &&
          (rt.maxChildren || 0) >= requiredChildren,
      );
    });

    hotels = hotels.filter((hotel) => hotel.roomTypes.length > 0);

    // Giá thấp nhất mỗi đêm của khách sạn (mặc định theo giá gốc)
    const priceOf = new Map();
    hotels.forEach((hotel) =>
      hotel.roomTypes.forEach((rt) => priceOf.set(rt._id.toString(), rt.basePrice)),
    );

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

          if (totalNights <= 0 || rtInventories.length < totalNights) return false;

          // Đủ số phòng khách cần cho MỌI đêm
          const isAvailable = rtInventories.every(
            (inv) => inv.availableRooms >= requiredRooms,
          );
          if (isAvailable) {
            const total = rtInventories.reduce((sum, inv) => sum + (inv.dynamicPrice || rt.basePrice), 0);
            priceOf.set(rt._id.toString(), Math.round(total / totalNights));
          }
          return isAvailable;
        });
      });

      hotels = hotels.filter((hotel) => hotel.roomTypes.length > 0);
    }

    hotels.forEach((hotel) => {
      hotel.priceFrom = Math.min(...hotel.roomTypes.map((rt) => priceOf.get(rt._id.toString())));
    });

    res.status(200).json({ success: true, count: hotels.length, amenities, data: hotels });
  } catch (error) {
    console.error("Lỗi searchHotels:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi tìm kiếm" });
  }
};

// [GET] /api/hotels/amenities - Danh sách tiện nghi chuẩn để làm bộ lọc, kèm số khách sạn có tiện nghi đó
exports.getAmenityFacets = async (req, res) => {
  try {
    const [hotels, rooms] = await Promise.all([
      Hotel.find({ status: "Approved" }).select("amenities").lean(),
      RoomType.find({ isActive: { $ne: false } }).select("hotelId title amenities").lean(),
    ]);
    const roomsByHotel = new Map();
    for (const room of rooms) {
      const key = room.hotelId.toString();
      if (!roomsByHotel.has(key)) roomsByHotel.set(key, []);
      roomsByHotel.get(key).push(room);
    }
    const haystacks = hotels.map((hotel) => amenityHaystack(hotel, roomsByHotel.get(hotel._id.toString())));

    const data = CATALOG
      .map(({ label, match }) => ({ label, count: haystacks.filter((text) => match.test(text)).length }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Lỗi lấy danh sách tiện nghi:", error);
    res.status(500).json({ success: false, message: "Không thể tải danh sách tiện nghi" });
  }
};
exports.getFeaturedHotels = async (req, res) => {
  try {
    const featuredHotels = await Hotel.find({ status: 'Approved' })
      .sort({ rating: -1 }) // -1 là xếp từ cao xuống thấp
      .limit(8);            // Chỉ lấy tối đa 8 bản ghi
      
    res.status(200).json({ success: true, data: featuredHotels });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách khách sạn' });
  }
};