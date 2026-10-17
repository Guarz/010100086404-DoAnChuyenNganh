const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const hotelRoutes = require('./Hotel-RAG-BE/routes/hotelRoutes');
const bookingRoutes = require('./Hotel-RAG-BE/routes/bookingRoutes');
const adminRoutes = require('./Hotel-RAG-BE/routes/adminRoutes');
const partnerRoutes = require('./Hotel-RAG-BE/routes/partnerRoutes');
const aiRoutes = require('./Hotel-RAG-BE/routes/aiRoutes'); // Import route AI

// Khởi tạo app
dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Route test cơ bản
app.get('/api/health', (req, res) => {
  res.json({ status: 'active', message: 'Hotel Booking AI API is running' });
});

app.use('/api/hotels', hotelRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes); 
app.use('/api/partner', partnerRoutes);

app.use('/api/ai', aiRoutes);
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});