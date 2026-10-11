// File: controllers/hotelController.js
const Hotel = require('../models/Hotel');
const RoomInventory = require('../models/RoomInventory');
const mongoose = require('mongoose');

exports.getAllHotels = async (req, res) => {
  try {
    const hotels = await Hotel.aggregate([
      { $match: { status: 'Approved' } }, // CHỈ LẤY KHÁCH SẠN ĐÃ DUYỆT
      {
        $lookup: {
          from: 'roomtypes', // Đổi từ 'rooms'
          localField: '_id',
          foreignField: 'hotelId',
          as: 'roomTypes' // Đổi tên mảng trả về
        }
      },
      { $project: { embedding: 0 } }
    ]);
    res.status(200).json({ success: true, count: hotels.length, data: hotels });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

exports.getHotelById = async (req, res) => {
  try {
    const hotelId = req.params.id;

    const hotel = await Hotel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(hotelId), status: 'Approved' } },
      {
        $lookup: {
          from: 'roomtypes',
          localField: '_id',
          foreignField: 'hotelId',
          as: 'roomTypes'
        }
      },
      { $project: { embedding: 0 } }
    ]);

    if (!hotel || hotel.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách sạn' });
    }

    res.status(200).json({ success: true, data: hotel[0] });
  } catch (error) {
    console.error("Lỗi getHotelById:", error);
    res.status(500).json({ success: false, message: 'Lỗi server hoặc ID không hợp lệ' });
  }
};

exports.searchHotels = async (req, res) => {
  try {
    const { city, checkIn, checkOut, adults, children } = req.query;

    const hotelFilter = { status: 'Approved' };
    if (city) {
      hotelFilter['address.city'] = new RegExp(city, 'i'); // Regex không phân biệt hoa thường
    }

    let hotels = await Hotel.aggregate([
      { $match: hotelFilter },
      {
        $lookup: {
          from: 'roomtypes',
          localField: '_id',
          foreignField: 'hotelId',
          as: 'roomTypes'
        }
      },
      { $project: { embedding: 0 } }
    ]);

    const requiredAdults = parseInt(adults) || 1;
    const requiredChildren = parseInt(children) || 0;

    hotels.forEach(hotel => {
      hotel.roomTypes = hotel.roomTypes.filter(rt => 
        rt.maxAdults >= requiredAdults && 
        rt.maxChildren >= requiredChildren
      );
    });

    hotels = hotels.filter(hotel => hotel.roomTypes.length > 0);

    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      
      const totalNights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
      const roomTypeIds = hotels.flatMap(h => h.roomTypes.map(rt => rt._id));

      const inventories = await RoomInventory.find({
        roomTypeId: { $in: roomTypeIds },
        date: { $gte: checkInDate, $lt: checkOutDate } // Lấy các ngày từ CheckIn đến trước CheckOut
      });

      hotels.forEach(hotel => {
        hotel.roomTypes = hotel.roomTypes.filter(rt => {
          const rtInventories = inventories.filter(
            inv => inv.roomTypeId.toString() === rt._id.toString()
          );
          
          if (rtInventories.length < totalNights) return false;

          const isAvailable = rtInventories.every(inv => inv.availableRooms > 0);
          return isAvailable;
        });
      });

      hotels = hotels.filter(hotel => hotel.roomTypes.length > 0);
    }

    res.status(200).json({ success: true, count: hotels.length, data: hotels });

  } catch (error) {
    console.error("Lỗi searchHotels:", error);
    res.status(500).json({ success: false, message: 'Lỗi server khi tìm kiếm' });
  }
};