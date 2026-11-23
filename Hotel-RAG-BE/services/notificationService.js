// File: services/notificationService.js
// Tạo thông báo trong trang. Mọi hàm ở đây KHÔNG bao giờ làm hỏng luồng chính (đặt phòng, thanh toán, duyệt):
// lỗi chỉ ghi log.
const Notification = require('../models/Notification');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const TransportCompany = require('../models/TransportCompany');

const shortId = (id) => String(id).slice(-6).toUpperCase();
const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')}₫`;

async function notify(userIds, { type, title, message, link }) {
  try {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
    if (!ids.length) return;
    await Notification.insertMany(ids.map((userId) => ({ userId, type, title, message, link })));
  } catch (error) {
    console.error('Không tạo được thông báo:', error.message);
  }
}

const adminIds = async () => (await User.find({ role: 'Admin', status: { $ne: 'Locked' } }).select('_id').lean()).map((u) => u._id);
const hotelOwnerOf = async (hotelId) => (await Hotel.findById(hotelId).select('partnerId hotelName').lean()) || {};
const companyOf = async (companyId) => (await TransportCompany.findById(companyId).select('ownerId companyName').lean()) || {};

// Đơn đã thanh toán: báo chủ khách sạn / nhà xe có đơn mới, báo khách đặt thành công
async function notifyOrderPaid(type, order) {
  if (type === 'hotel') {
    const hotel = await hotelOwnerOf(order.hotelId);
    await notify(hotel.partnerId, {
      type: 'order_new', title: `Đơn đặt phòng mới #${shortId(order._id)}`,
      message: `${hotel.hotelName || 'Khách sạn'} có đơn mới ${money(order.totalAmount)}, nhận phòng ${new Date(order.checkInDate).toLocaleDateString('vi-VN')}.`,
      link: '/partner'
    });
    await notify(order.customerId, {
      type: 'order_paid', title: `Đặt phòng thành công #${shortId(order._id)}`,
      message: `Đã thanh toán ${money(order.totalAmount)} cho ${hotel.hotelName || 'khách sạn'}.`,
      link: '/profile?tab=booking'
    });
  } else {
    const company = await companyOf(order.companyId);
    await notify(company.ownerId, {
      type: 'order_new', title: `Đơn đặt xe mới #${shortId(order._id)}`,
      message: `Đón khách lúc ${new Date(order.pickupTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}, ${money(order.totalAmount)}.`,
      link: '/transport'
    });
    await notify(order.customerId, {
      type: 'order_paid', title: `Đặt xe thành công #${shortId(order._id)}`,
      message: `Đã thanh toán ${money(order.totalAmount)} cho ${company.companyName || 'nhà xe'}.`,
      link: '/profile?tab=transfers'
    });
  }
}

// Khách tự hủy đơn: báo chủ khách sạn / nhà xe
async function notifyOrderCanceledByCustomer(type, order) {
  if (type === 'hotel') {
    const hotel = await hotelOwnerOf(order.hotelId);
    await notify(hotel.partnerId, {
      type: 'order_canceled', title: `Khách đã hủy đơn #${shortId(order._id)}`,
      message: `Đơn ${money(order.totalAmount)} tại ${hotel.hotelName || 'khách sạn'} đã hủy, phòng được mở bán lại.`,
      link: '/partner'
    });
  } else {
    const company = await companyOf(order.companyId);
    await notify(company.ownerId, {
      type: 'order_canceled', title: `Khách đã hủy đơn xe #${shortId(order._id)}`,
      message: `Đơn ${money(order.totalAmount)} đã hủy, xe được mở bán lại.`,
      link: '/transport'
    });
  }
}

// Cron hủy đơn quá hạn thanh toán: báo khách
async function notifyOrderExpired(type, order) {
  await notify(order.customerId, {
    type: 'order_expired',
    title: `Đơn #${shortId(order._id)} đã tự hủy`,
    message: `Đơn ${type === 'hotel' ? 'đặt phòng' : 'đặt xe'} quá 5 phút chưa thanh toán nên đã tự hủy. Bạn có thể đặt lại bất cứ lúc nào.`,
    link: type === 'hotel' ? '/profile?tab=booking' : '/profile?tab=transfers'
  });
}

// Kết quả duyệt hồ sơ (khách sạn / đối tác / nhà xe)
async function notifyReviewResult(userId, { approved, subject, reason, link }) {
  await notify(userId, {
    type: approved ? 'application_approved' : 'application_rejected',
    title: approved ? `${subject} đã được duyệt` : `${subject} bị từ chối`,
    message: approved ? 'Bạn có thể bắt đầu sử dụng ngay.' : (reason ? `Lý do: ${reason}` : 'Vui lòng xem lại hồ sơ và gửi lại.'),
    link
  });
}

// Hồ sơ mới chờ duyệt: báo mọi Admin
async function notifyAdminsNewSubmission(subject, link = '/admin') {
  await notify(await adminIds(), { type: 'application_submitted', title: `${subject} chờ duyệt`, message: 'Vào Trung tâm quản trị để xem và duyệt.', link });
}

module.exports = {
  notify, notifyOrderPaid, notifyOrderCanceledByCustomer, notifyOrderExpired, notifyReviewResult, notifyAdminsNewSubmission
};
