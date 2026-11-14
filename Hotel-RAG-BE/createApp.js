// File: createApp.js
// Khởi tạo Express app (routes + middleware) tách khỏi việc kết nối DB / listen,
// để server.js dùng khi chạy thật và bộ test (tests/) dùng khi kiểm thử API.
const express = require('express');
const cors = require('cors');

const hotelRoutes = require('./routes/hotelRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const partnerRoutes = require('./routes/partnerRoutes');
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require('./routes/authRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const userRoutes = require('./routes/userRoutes');
const transportRoutes = require('./routes/transportRoutes');
const transferRoutes = require('./routes/transferRoutes');

module.exports = function createApp() {
  const app = express();

  // CORS_ORIGIN (tùy chọn): danh sách domain frontend, cách nhau dấu phẩy. Không đặt = cho phép mọi nguồn.
  const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
  app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'active', message: 'Hotel Booking AI API is running' });
  });

  app.use('/api/hotels', hotelRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/partner', partnerRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/transport', transportRoutes); // Nhà xe
  app.use('/api/transfers', transferRoutes); // Khách đặt xe đưa đón

  return app;
};
