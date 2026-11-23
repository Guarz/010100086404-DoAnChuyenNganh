// File: controllers/paymentController.js
const crypto = require('crypto');
const querystring = require('qs'); 
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const TransferBooking = require('../models/TransferBooking');
const mongoose = require('mongoose');
const { notifyOrderPaid } = require('../services/notificationService');

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

// Xác nhận đơn đã thanh toán (dùng chung VNPay / MoMo). Trả về { status, body } để controller gửi về.
// - Kiểm tra số tiền đã trả khớp tổng tiền hiện tại của đơn (đơn có thể đã đổi mã giảm giá sau khi tạo link)
// - Cập nhật nguyên tử: chỉ xác nhận nếu đơn vẫn Pending; gọi lại nhiều lần (IPN + trình duyệt) không tạo trùng Payment
async function confirmPaid(target, { method, paidAmount, transactionId }) {
  const type = target.type;
  const doc = target.doc;
  if (doc[target.statusField] === 'Confirmed' || doc[target.statusField] === 'Completed') {
    return { status: 200, body: { success: true, type, message: 'Giao dịch thành công' } };
  }
  if (Number(paidAmount) !== Number(doc.totalAmount)) {
    await Payment.create({ [target.paymentKey]: doc._id, paymentMethod: method, amount: Number(paidAmount) || 0, paymentStatus: 'Failed', transactionId });
    return { status: 400, body: { success: false, type, message: 'Số tiền thanh toán không khớp với đơn hàng (đơn đã thay đổi sau khi tạo link). Vui lòng liên hệ hỗ trợ.' } };
  }
  const booking = await target.Model.findOneAndUpdate(
    { _id: doc._id, [target.statusField]: 'Pending' },
    { $set: { [target.statusField]: 'Confirmed' }, $unset: { expiresAt: 1 } },
    { returnDocument: 'after' }
  );
  if (!booking) {
    const current = await target.Model.findById(doc._id).select(target.statusField).lean();
    if (current?.[target.statusField] === 'Confirmed') {
      return { status: 200, body: { success: true, type, message: 'Giao dịch thành công' } };
    }
    return {
      status: 409,
      body: { success: false, type, message: 'Đơn đã hết hạn giữ chỗ trước khi thanh toán hoàn tất. Vui lòng liên hệ hỗ trợ để được hoàn tiền.' }
    };
  }
  await Payment.create({
    [target.paymentKey]: booking._id, paymentMethod: method, amount: booking.totalAmount,
    paymentStatus: 'Success', paymentDate: new Date(), transactionId
  });
  await notifyOrderPaid(type, booking).catch((e) => console.error('Lỗi gửi thông báo đơn mới:', e.message));
  return { status: 200, body: { success: true, type, message: 'Giao dịch thành công' } };
}

// Ghi nhận giao dịch thất bại để đối soát (đơn vẫn Pending, cronjob sẽ hủy và hoàn quỹ)
async function markFailed(target, method, amount, transactionId) {
  if (!target) return;
  await Payment.create({ [target.paymentKey]: target.doc._id, paymentMethod: method, amount: Number(amount) || target.doc.totalAmount, paymentStatus: 'Failed', transactionId });
}

// 2. XÁC THỰC KẾT QUẢ TỪ VNPAY TRẢ VỀ
exports.vnpayReturn = async (req, res) => {
  try {
    let vnp_Params = { ...req.query };
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    const secretKey = process.env.VNP_HASH_SECRET;
    const signData = querystring.stringify(vnp_Params, { encode: false });
    const signed = crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== signed) {
      return res.status(400).json({ success: false, message: 'Chữ ký không hợp lệ' });
    }
    const bookingId = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const paidAmount = Number(vnp_Params['vnp_Amount']) / 100; // VNPay gửi số tiền x100
    const transactionId = vnp_Params['vnp_TransactionNo'];
    const target = await findPayable(bookingId);
    if (!target) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

    if (responseCode === '00') {
      const result = await confirmPaid(target, { method: 'VNPay', paidAmount, transactionId });
      return res.status(result.status).json(result.body);
    }
    await markFailed(target, 'VNPay', paidAmount, transactionId);
    return res.status(400).json({ success: false, type: target.type, message: 'Giao dịch bị hủy hoặc thất bại' });
  } catch (error) {
    console.error('Lỗi xác thực VNPay:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

// =====================================================================
// MOMO (môi trường thử nghiệm - sandbox)
// Mặc định dùng bộ khóa test công khai trong tài liệu MoMo cho nhà phát triển (không phải tiền thật).
// Dùng tài khoản thật thì đặt MOMO_PARTNER_CODE / MOMO_ACCESS_KEY / MOMO_SECRET_KEY / MOMO_ENDPOINT.
// =====================================================================
const momoConfig = () => ({
  partnerCode: process.env.MOMO_PARTNER_CODE || 'MOMO',
  accessKey: process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85',
  secretKey: process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
  endpoint: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create',
  requestType: process.env.MOMO_REQUEST_TYPE || 'captureWallet'
});

const momoSign = (raw, secretKey) => crypto.createHmac('sha256', secretKey).update(raw).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Địa chỉ frontend / backend công khai để MoMo chuyển hướng và gọi IPN
const appUrl = () => (process.env.APP_URL || (process.env.CORS_ORIGIN || '').split(',')[0] || 'http://localhost:5173').trim().replace(/\/$/, '');
const backendUrl = (req) => {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
  return `${proto}://${req.get('host')}`;
};

// 3. TẠO LINK THANH TOÁN MOMO  Body: { bookingId } hoặc { transferBookingId }
exports.createMoMoUrl = async (req, res) => {
  try {
    const isTransfer = Boolean(req.body.transferBookingId);
    const bookingId = isTransfer ? req.body.transferBookingId : req.body.bookingId;
    const target = await findPayable(bookingId, isTransfer ? 'transfer' : 'hotel');
    const booking = target?.doc;
    if (booking && booking.customerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thanh toán đơn này' });
    }
    if (!booking || booking[target.statusField] !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Đơn đặt không hợp lệ' });
    }
    if (booking.expiresAt && booking.expiresAt <= new Date()) {
      return res.status(410).json({ success: false, message: 'Đơn đã hết thời gian giữ chỗ, vui lòng đặt lại' });
    }

    const cfg = momoConfig();
    const amount = String(booking.totalAmount);
    const orderId = `${bookingId}-${Date.now()}`; // MoMo yêu cầu mã đơn không trùng giữa các lần tạo link
    const requestId = orderId;
    const orderInfo = `Thanh toan don ${String(bookingId).slice(-6).toUpperCase()} - Nestly`;
    const redirectUrl = process.env.MOMO_REDIRECT_URL || `${appUrl()}/payment/momo-return`;
    const ipnUrl = process.env.MOMO_IPN_URL || `${backendUrl(req)}/api/payments/momo/ipn`;
    const extraData = Buffer.from(JSON.stringify({ type: target.type })).toString('base64');
    const raw = `accessKey=${cfg.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}` +
      `&orderInfo=${orderInfo}&partnerCode=${cfg.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${cfg.requestType}`;
    // Link MoMo hết hạn cùng lúc với thời gian giữ chỗ (tối thiểu 1 phút)
    const minutesLeft = booking.expiresAt ? Math.max(1, Math.floor((booking.expiresAt - Date.now()) / 60000)) : 5;

    const response = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        partnerCode: cfg.partnerCode, partnerName: 'Nestly', storeId: 'Nestly',
        requestId, amount, orderId, orderInfo, redirectUrl, ipnUrl, lang: 'vi',
        requestType: cfg.requestType, autoCapture: true, extraData, orderExpireTime: minutesLeft,
        signature: momoSign(raw, cfg.secretKey)
      })
    });
    // Đọc dạng text trước: khi MoMo chặn yêu cầu (vd. IP máy chủ ở nước ngoài) có thể trả HTML thay vì JSON
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch { /* không phải JSON */ }
    if (data.resultCode !== 0 || !data.payUrl) {
      console.error('MoMo từ chối tạo giao dịch:', response.status, data.resultCode, data.message || text.slice(0, 300));
      const reason = data.message
        ? `${data.message} (mã ${data.resultCode})`
        : `MoMo trả HTTP ${response.status}, không phải dữ liệu JSON (có thể máy chủ bị MoMo chặn theo vùng)`;
      return res.status(502).json({ success: false, message: `MoMo từ chối tạo giao dịch: ${reason}` });
    }
    return res.status(200).json({ success: true, paymentUrl: data.payUrl });
  } catch (error) {
    console.error('Lỗi tạo thanh toán MoMo:', error);
    return res.status(500).json({ success: false, message: 'Không thể kết nối MoMo lúc này' });
  }
};

// Kiểm tra chữ ký kết quả MoMo gửi về (trình duyệt quay lại hoặc IPN) và xử lý đơn
async function handleMoMoResult(params) {
  const cfg = momoConfig();
  const raw = `accessKey=${cfg.accessKey}&amount=${params.amount}&extraData=${params.extraData || ''}&message=${params.message}` +
    `&orderId=${params.orderId}&orderInfo=${params.orderInfo}&orderType=${params.orderType}&partnerCode=${params.partnerCode}` +
    `&payType=${params.payType}&requestId=${params.requestId}&responseTime=${params.responseTime}&resultCode=${params.resultCode}&transId=${params.transId}`;
  if (!safeEqual(momoSign(raw, cfg.secretKey), params.signature)) {
    return { status: 400, body: { success: false, message: 'Chữ ký không hợp lệ' } };
  }
  const bookingId = String(params.orderId || '').split('-')[0];
  const target = await findPayable(bookingId);
  if (!target) return { status: 404, body: { success: false, message: 'Không tìm thấy đơn hàng' } };
  if (String(params.resultCode) === '0') {
    return confirmPaid(target, { method: 'Momo', paidAmount: Number(params.amount), transactionId: String(params.transId) });
  }
  await markFailed(target, 'Momo', params.amount, String(params.transId || ''));
  return { status: 400, body: { success: false, type: target.type, message: params.message || 'Giao dịch MoMo bị hủy hoặc thất bại' } };
}

// 4. TRÌNH DUYỆT QUAY LẠI TỪ MOMO (frontend /payment/momo-return gọi kèm query)
exports.momoReturn = async (req, res) => {
  try {
    const result = await handleMoMoResult({ ...req.query });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Lỗi xác thực MoMo:', error);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
  }
};

// 5. IPN: server MoMo gọi thẳng vào backend (cần địa chỉ công khai, vd. trên Render). MoMo chờ HTTP 204.
exports.momoIpn = async (req, res) => {
  try {
    const result = await handleMoMoResult({ ...req.body });
    if (result.status >= 500) return res.status(500).end();
    return res.status(204).end();
  } catch (error) {
    console.error('Lỗi IPN MoMo:', error);
    return res.status(500).end();
  }
};

// Dùng trong test
exports._momo = { momoConfig, momoSign };
