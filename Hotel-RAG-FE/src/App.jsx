import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import HotelDetail from './pages/HotelDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang chủ: hiển thị danh sách */}
        <Route path="/" element={<Home />} />
        
        {/* Trang chi tiết: URL có chứa ID khách sạn */}
        <Route path="/hotel/:id" element={<HotelDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;