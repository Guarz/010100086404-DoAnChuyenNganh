import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function Home() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('http://localhost:5000/api/hotels')
      .then(res => {
        setHotels(res.data.data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, []);

  if (loading) return <div className="text-center p-10 text-xl">Đang tải dữ liệu...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">Khách sạn gợi ý bởi AI</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {hotels.map(hotel => (
            <div key={hotel._id} className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col">
              <div className="h-48 bg-blue-100 flex items-center justify-center text-blue-400 font-medium">
                [Hình ảnh khách sạn]
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-xl font-bold text-gray-800">{hotel.name}</h2>
                  <span className="bg-yellow-100 text-yellow-800 text-sm font-bold px-2 py-1 rounded">★ {hotel.rating}</span>
                </div>
                <p className="text-gray-500 text-sm mb-4">📍 {hotel.address?.street}, {hotel.address?.city}</p>
                <p className="text-gray-700 text-sm mb-4 line-clamp-3">{hotel.description}</p>
                
                <div className="mt-auto">
                  {/* Đổi thẻ button thành thẻ Link để chuyển hướng */}
                  <Link 
                    to={`/hotel/${hotel._id}`} 
                    className="block text-center mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
                  >
                    Xem chi tiết & Đặt phòng
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}