import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

export default function HotelDetail() {
  const { id } = useParams(); // Lấy ID từ URL
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`http://localhost:5000/api/hotels/${id}`)
      .then(res => {
        setHotel(res.data.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="text-center p-10 text-xl">Đang tải chi tiết...</div>;
  if (!hotel) return <div className="text-center p-10 text-xl">Không tìm thấy khách sạn</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">← Quay lại danh sách</Link>
        
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{hotel.name}</h1>
        <p className="text-gray-500 mb-6">📍 {hotel.address?.street}, {hotel.address?.city}</p>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Mô tả</h3>
          <p className="text-gray-700 leading-relaxed">{hotel.description}</p>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Tiện nghi</h3>
          <div className="flex flex-wrap gap-2">
            {hotel.amenities?.map((amenity, idx) => (
              <span key={idx} className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                {amenity}
              </span>
            ))}
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-2xl font-bold mb-4">Các loại phòng ({hotel.rooms?.length})</h3>
          <div className="space-y-4">
            {hotel.rooms?.map(room => (
              <div key={room._id} className="border rounded-lg p-4 flex justify-between items-center">
                <div>
                  <h4 className="text-lg font-semibold">{room.title}</h4>
                  <p className="text-sm text-gray-500">
                    Sức chứa: {room.capacity?.adults} người lớn, {room.capacity?.children} trẻ em
                  </p>
                  <p className="text-sm text-gray-500">Tiện nghi: {room.amenities?.join(', ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-blue-600 mb-2">
                    {room.pricePerNight.toLocaleString('vi-VN')} đ <span className="text-sm text-gray-500 font-normal">/ đêm</span>
                  </p>
                  <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded">
                    Đặt phòng này
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}