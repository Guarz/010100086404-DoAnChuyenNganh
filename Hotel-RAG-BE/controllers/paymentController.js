const paymentUnavailable = (req, res) => {
  return res.status(503).json({
    success: false,
    message: 'Chức năng thanh toán chưa được bật. Đơn tạm sẽ tự hết hạn sau 5 phút.'
  });
};

exports.createVNPayUrl = paymentUnavailable;
exports.vnpayReturn = paymentUnavailable;
