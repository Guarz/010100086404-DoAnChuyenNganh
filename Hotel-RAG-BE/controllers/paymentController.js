// File: controllers/paymentController.js
const crypto = require('crypto');
const querystring = require('qs'); 
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');

const formatVNPayDate = (date) => {
  const pad = (n) => (n < 10 ? '0' + n : n);
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const sortObject = (obj) => {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    // Express 5 tạo req.query không có prototype -> obj.hasOwnProperty() sẽ throw TypeError
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
};

// 1. TẠO URL THANH TOÁN VNPAY
exports.createVNPayUrl = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = mongoose.isValidObjectId(bookingId) ? await Booking.findById(bookingId) : null;

    // Chỉ chủ đơn mới được tạo link thanh toán cho đơn của mình
    if (booking && booking.customerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thanh toán đơn này' });
    }

    if (!booking || booking.bookingStatus !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Đơn đặt phòng không hợp lệ' });
    }

    if (booking.expiresAt && booking.expiresAt <= new Date()) {
      return res.status(410).json({ success: false, message: 'Đơn đã hết thời gian giữ chỗ, vui lòng đặt lại' });
    }

    const ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;

    const date = new Date();
    const createDate = formatVNPayDate(date);
    
    // Link VNPay hết hạn cùng lúc với thời gian giữ chỗ, tránh khách trả tiền cho đơn cronjob đã hủy
    const expireDate = formatVNPayDate(booking.expiresAt || new Date(date.getTime() + 5 * 60 * 1000));

    let vnp_Params = {
      'vnp_Version': '2.1.0',
      'vnp_Command': 'pay',
      'vnp_TmnCode': tmnCode,
      'vnp_Locale': 'vn',
      'vnp_CurrCode': 'VND',
      'vnp_TxnRef': bookingId,
      'vnp_OrderInfo': `Thanh toan don hang ${bookingId}`,
      'vnp_OrderType': 'other',
      'vnp_Amount': booking.totalAmount * 100, // VNPay yêu cầu nhân 100
      'vnp_ReturnUrl': returnUrl,
      'vnp_IpAddr': ipAddr,
      'vnp_CreateDate': createDate,
      'vnp_ExpireDate': expireDate
    };

    vnp_Params = sortObject(vnp_Params);
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    // ĐÃ FIX LỖI Buffer.from Ở ĐÂY
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    
    vnp_Params['vnp_SecureHash'] = signed;
    const paymentUrl = vnpUrl + '?' + querystring.stringify(vnp_Params, { encode: false });

    res.status(200).json({ success: true, paymentUrl });
  } catch (error) {
    console.error("Lỗi tạo VNPay:", error);
    res.status(500).json({ success: false, message: "Lỗi tạo URL thanh toán" });
  }
};

// 2. XÁC THỰC KẾT QUẢ TỪ VNPAY TRẢ VỀ
exports.vnpayReturn = async (req, res) => {
  try {
    let vnp_Params = req.query;
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    const secretKey = process.env.VNP_HASH_SECRET;
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    
    // ĐÃ FIX LỖI Buffer.from Ở ĐÂY
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    if (secureHash === signed) {
      const bookingId = vnp_Params['vnp_TxnRef'];
      const responseCode = vnp_Params['vnp_ResponseCode'];

      if (responseCode === '00') {
        // Cập nhật nguyên tử: chỉ xác nhận nếu đơn vẫn đang Pending (chưa bị cronjob hủy)
        const booking = await Booking.findOneAndUpdate(
          { _id: bookingId, bookingStatus: 'Pending' },
          { $set: { bookingStatus: 'Confirmed' }, $unset: { expiresAt: 1 } },
          { new: true }
        );
        if (!booking) {
          const existing = await Booking.findById(bookingId).select('bookingStatus');
          if (existing?.bookingStatus === 'Canceled') {
            return res.status(409).json({
              success: false,
              message: "Đơn đã hết hạn giữ chỗ trước khi thanh toán hoàn tất. Vui lòng liên hệ hỗ trợ để được hoàn tiền."
            });
          }
        }
        if (booking) {
          const payment = new Payment({
            bookingId: booking._id,
            paymentMethod: 'VNPay',
            amount: booking.totalAmount,
            paymentStatus: 'Success',
            paymentDate: new Date()
          });
          await payment.save();
        }
        return res.status(200).json({ success: true, message: "Giao dịch thành công" });
      } else {
        // Ghi nhận giao dịch thất bại để đối soát (đơn vẫn Pending, cronjob sẽ hủy và hoàn quỹ)
        const booking = await Booking.findById(bookingId).select('totalAmount');
        if (booking) {
          await Payment.create({
            bookingId: booking._id,
            paymentMethod: 'VNPay',
            amount: booking.totalAmount,
            paymentStatus: 'Failed'
          });
        }
        return res.status(400).json({ success: false, message: "Giao dịch bị hủy hoặc thất bại" });
      }
    } else {
      return res.status(400).json({ success: false, message: "Chữ ký không hợp lệ" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};