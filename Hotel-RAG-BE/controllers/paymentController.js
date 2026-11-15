// File: controllers/paymentController.js
const crypto = require('crypto');
const querystring = require('qs'); 
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const TransferBooking = require('../models/TransferBooking');
const mongoose = require('mongoose');

// VNPay hiểu vnp_CreateDate / vnp_ExpireDate là giờ Việt Nam (GMT+7), dạng yyyyMMddHHmmss.
// Luôn quy đổi sang GMT+7, KHÔNG dùng getHours() theo múi giờ máy chủ: trên Render máy chủ chạy UTC
// (chậm 7 tiếng) khiến hạn thanh toán bị coi là đã qua -> VNPay báo "Giao dịch đã quá thời gian chờ thanh toán".
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const formatVNPayDate = (date) => {
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${vn.getUTCFullYear()}${pad(vn.getUTCMonth() + 1)}${pad(vn.getUTCDate())}${pad(vn.getUTCHours())}${pad(vn.getUTCMinutes())}${pad(vn.getUTCSeconds())}`;
};
exports.formatVNPayDate = formatVNPayDate;

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

// Hai loại đơn dùng chung luồng thanh toán VNPay: đơn phòng và đơn xe đưa đón
const PAYABLE = {
  hotel: { Model: Booking, statusField: 'bookingStatus', paymentKey: 'bookingId' },
  transfer: { Model: TransferBooking, statusField: 'status', paymentKey: 'transferBookingId' }
};

// Tìm đơn theo mã giao dịch (vnp_TxnRef = _id của đơn); ObjectId không trùng giữa 2 collection
const findPayable = async (id, kind) => {
  if (!mongoose.isValidObjectId(id)) return null;
  for (const type of kind ? [kind] : ['hotel', 'transfer']) {
    const doc = await PAYABLE[type].Model.findById(id);
    if (doc) return { type, doc, ...PAYABLE[type] };
  }
  return null;
};

// 1. TẠO URL THANH TOÁN VNPAY  Body: { bookingId } (đơn phòng) hoặc { transferBookingId } (đơn xe)
exports.createVNPayUrl = async (req, res) => {
  try {
    const isTransfer = Boolean(req.body.transferBookingId);
    const bookingId = isTransfer ? req.body.transferBookingId : req.body.bookingId;
    const target = await findPayable(bookingId, isTransfer ? 'transfer' : 'hotel');
    const booking = target?.doc;

    // Chỉ chủ đơn mới được tạo link thanh toán cho đơn của mình
    if (booking && booking.customerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thanh toán đơn này' });
    }

    if (!booking || booking[target.statusField] !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Đơn đặt không hợp lệ' });
    }

    if (booking.expiresAt && booking.expiresAt <= new Date()) {
      return res.status(410).json({ success: false, message: 'Đơn đã hết thời gian giữ chỗ, vui lòng đặt lại' });
    }

    // Sau proxy (Render...) header có dạng "ip-khách, ip-proxy" -> chỉ lấy IP đầu tiên cho VNPay
    const ipAddr = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '127.0.0.1';
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
      const target = await findPayable(bookingId);
      const type = target?.type || null;

      if (responseCode === '00') {
        // Cập nhật nguyên tử: chỉ xác nhận nếu đơn vẫn đang Pending (chưa bị cronjob hủy)
        const booking = target && await target.Model.findOneAndUpdate(
          { _id: bookingId, [target.statusField]: 'Pending' },
          { $set: { [target.statusField]: 'Confirmed' }, $unset: { expiresAt: 1 } },
          { returnDocument: 'after' }
        );
        if (!booking && target?.doc[target.statusField] === 'Canceled') {
          return res.status(409).json({
            success: false, type,
            message: "Đơn đã hết hạn giữ chỗ trước khi thanh toán hoàn tất. Vui lòng liên hệ hỗ trợ để được hoàn tiền."
          });
        }
        if (booking) {
          await Payment.create({
            [target.paymentKey]: booking._id,
            paymentMethod: 'VNPay',
            amount: booking.totalAmount,
            paymentStatus: 'Success',
            paymentDate: new Date()
          });
        }
        return res.status(200).json({ success: true, type, message: "Giao dịch thành công" });
      } else {
        // Ghi nhận giao dịch thất bại để đối soát (đơn vẫn Pending, cronjob sẽ hủy và hoàn quỹ)
        if (target) {
          await Payment.create({
            [target.paymentKey]: target.doc._id,
            paymentMethod: 'VNPay',
            amount: target.doc.totalAmount,
            paymentStatus: 'Failed'
          });
        }
        return res.status(400).json({ success: false, type, message: "Giao dịch bị hủy hoặc thất bại" });
      }
    } else {
      return res.status(400).json({ success: false, message: "Chữ ký không hợp lệ" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};