const crypto = require('crypto');
const querystring = require('qs'); // Nếu chưa có, chạy: npm install qs
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

// Hàm hỗ trợ format ngày chuẩn VNPay (YYYYMMDDHHmmss)
const formatVNPayDate = (date) => {
  const pad = (n) => (n < 10 ? '0' + n : n);
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

// Hàm hỗ trợ sắp xếp Object theo alphabet (Bắt buộc của VNPay)
const sortObject = (obj) => {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
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
    const booking = await Booking.findById(bookingId);
    
    if (!booking || booking.bookingStatus !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Đơn đặt phòng không hợp lệ' });
    }

    const ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;

    const date = new Date();
    const createDate = formatVNPayDate(date);
    
    // Hạn thanh toán 15 phút
    date.setMinutes(date.getMinutes() + 15);
    const expireDate = formatVNPayDate(date);

    let vnp_Params = {
      'vnp_Version': '2.1.0',
      'vnp_Command': 'pay',
      'vnp_TmnCode': tmnCode,
      'vnp_Locale': 'vn',
      'vnp_CurrCode': 'VND',
      'vnp_TxnRef': bookingId,
      'vnp_OrderInfo': `Thanh toan Don dat phong ${bookingId}`,
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
    const signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest("hex");
    
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
    const signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest("hex");

    if (secureHash === signed) {
      const bookingId = vnp_Params['vnp_TxnRef'];
      const responseCode = vnp_Params['vnp_ResponseCode'];

      if (responseCode === '00') {
        // Thanh toán thành công -> Cập nhật Database
        const booking = await Booking.findById(bookingId);
        if (booking && booking.bookingStatus === 'Pending') {
          booking.bookingStatus = 'Confirmed';
          await booking.save();

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
        return res.status(400).json({ success: false, message: "Giao dịch bị hủy hoặc thất bại" });
      }
    } else {
      return res.status(400).json({ success: false, message: "Chữ ký không hợp lệ (Fake request)" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};