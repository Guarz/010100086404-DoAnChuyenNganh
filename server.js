const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Nạp .env TRƯỚC khi require các module đọc process.env
dotenv.config();
const createApp = require('./Hotel-RAG-BE/createApp');
const { startBookingCron } = require('./Hotel-RAG-BE/jobs/bookingCron');

const app = createApp();

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Chỉ chạy cronjob khi đã có kết nối DB
    return startBookingCron();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
