// File: controllers/authController.js
// Đăng ký (tên đăng nhập + email + mật khẩu, xác nhận qua email), đăng nhập bằng tên đăng nhập,
// quên mật khẩu / đặt lại mật khẩu qua link gửi email.
const crypto = require('crypto');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mail = require('../services/mailService');

const USERNAME_RE = /^[a-z0-9._]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // link xác nhận email: 24 giờ
const RESET_TTL_MS = 30 * 60 * 1000; // link đặt lại mật khẩu: 30 phút
const MAIL_COOLDOWN_MS = 60 * 1000; // tối thiểu 60 giây giữa 2 email cho cùng tài khoản
const MAX_ACCOUNTS_PER_EMAIL = 10; // số tài khoản tối đa xử lý cho 1 email (đăng nhập bằng email, gửi mail hàng loạt)

// Có bắt buộc xác nhận email trước khi đăng nhập không:
// EMAIL_VERIFICATION=required|off; không đặt -> bắt buộc khi đã cấu hình gửi mail thật (Brevo).
// (Nếu chưa cấu hình gửi mail mà vẫn bắt buộc, người dùng mới sẽ không thể đăng nhập.)
const verificationRequired = () => {
  const v = (process.env.EMAIL_VERIFICATION || '').toLowerCase();
  if (v === 'required') return true;
  if (v === 'off') return false;
  return mail.isRealMailEnabled();
};

const newToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') };
};
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const normalizeUsername = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const maskEmail = (email) => email.replace(/^(.{2})[^@]*(@.*)$/, (_, a, b) => `${a}***${b}`);
// Mỗi loại email (xác nhận / đặt lại mật khẩu) có bộ đếm riêng
const onCooldown = (sentAt) => !!sentAt && Date.now() - sentAt.getTime() < MAIL_COOLDOWN_MS;

// Gửi lại link xác nhận cho user chưa xác nhận (dùng chung cho đăng ký và "gửi lại")
async function issueVerification(user) {
  const { token, hash } = newToken();
  user.emailVerifyTokenHash = hash;
  user.emailVerifyExpires = new Date(Date.now() + VERIFY_TTL_MS);
  user.lastVerifyMailAt = new Date();
  await user.save();
  await mail.sendVerificationEmail(user, token);
}

// [POST] /api/auth/register  { username, email, password }
exports.register = async (req, res) => {
  const username = normalizeUsername(req.body.username);
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ success: false, message: 'Tên đăng nhập 3–30 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm hoặc gạch dưới' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 100) {
    return res.status(400).json({ success: false, message: 'Mật khẩu phải từ 8 ký tự' });
  }

  try {
    // Chỉ tên đăng nhập phải duy nhất; một email được dùng cho nhiều tài khoản
    if (await User.exists({ username })) {
      return res.status(409).json({ success: false, field: 'username', message: 'Tên đăng nhập đã có người dùng' });
    }

    const mustVerify = verificationRequired();
    const user = new User({
      username,
      fullName: username, // người dùng đổi họ tên sau trong trang Tài khoản
      email,
      password: await bcrypt.hash(password, 10),
      role: 'Customer',
      emailVerified: !mustVerify
    });
    await user.save();

    if (!mustVerify) {
      return res.status(201).json({ success: true, requiresVerification: false, message: 'Tạo tài khoản thành công! Bạn có thể đăng nhập ngay.' });
    }
    try {
      await issueVerification(user);
    } catch (mailError) {
      console.error('Không gửi được email xác nhận:', mailError.message);
      return res.status(201).json({
        success: true, requiresVerification: true, mailSent: false, email,
        message: 'Đã tạo tài khoản nhưng chưa gửi được email xác nhận. Hãy bấm "Gửi lại email xác nhận" sau ít phút.'
      });
    }
    return res.status(201).json({
      success: true, requiresVerification: true, mailSent: true, email,
      message: `Đã gửi email xác nhận tới ${email}. Hãy mở email và bấm "Xác nhận email" để kích hoạt tài khoản.`
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, field: 'username', message: 'Tên đăng nhập đã có người dùng' });
    }
    console.error('Lỗi đăng ký:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// [POST] /api/auth/login  { username, password }
// Tài khoản cũ chưa có tên đăng nhập vẫn đăng nhập được bằng email ở cùng ô.
exports.login = async (req, res) => {
  try {
    const identifier = normalizeUsername(req.body.username ?? req.body.email);
    const { password } = req.body;
    if (!identifier || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }
    // Gõ email (tài khoản cũ): một email có thể thuộc nhiều tài khoản -> lấy tài khoản khớp mật khẩu
    const candidates = identifier.includes('@')
      ? await User.find({ email: identifier }).sort({ createdAt: 1 }).limit(MAX_ACCOUNTS_PER_EMAIL)
      : await User.find({ username: identifier }).limit(1);
    let user = null;
    for (const candidate of candidates) {
      if (await bcrypt.compare(password, candidate.password)) { user = candidate; break; }
    }
    if (!user) {
      return res.status(400).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
    if (user.status === 'Locked') {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa, vui lòng liên hệ quản trị viên' });
    }
    if (user.emailVerified === false) {
      return res.status(403).json({
        success: false, code: 'EMAIL_NOT_VERIFIED', email: maskEmail(user.email),
        message: `Tài khoản chưa xác nhận email. Hãy mở email gửi tới ${maskEmail(user.email)} và bấm link xác nhận.`
      });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const data = user.toObject();
    delete data.password;
    return res.status(200).json({ success: true, token, user: data });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// [POST] /api/auth/verify-email  { token }
exports.verifyEmail = async (req, res) => {
  const { token } = req.body;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ success: false, message: 'Link xác nhận không hợp lệ' });
  }
  try {
    const user = await User.findOne({ emailVerifyTokenHash: hashToken(token) }).select('+emailVerifyExpires');
    if (!user) {
      return res.status(400).json({ success: false, message: 'Link xác nhận không hợp lệ hoặc đã được dùng' });
    }
    if (user.emailVerifyExpires < new Date()) {
      return res.status(400).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Link xác nhận đã hết hạn, hãy gửi lại email xác nhận' });
    }
    user.emailVerified = true;
    user.emailVerifyTokenHash = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();
    return res.status(200).json({ success: true, username: user.username, message: 'Đã xác nhận email. Bạn có thể đăng nhập ngay.' });
  } catch (error) {
    console.error('Lỗi xác nhận email:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// Câu trả lời chung để không lộ email nào đã đăng ký
const GENERIC_SENT = 'Nếu thông tin khớp với một tài khoản, email đã được gửi. Hãy kiểm tra hộp thư (cả mục Spam).';

// [POST] /api/auth/resend-verification  { email }
exports.resendVerification = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
  try {
    // Mọi tài khoản chưa xác nhận dùng email này đều nhận lại link (mỗi email ghi rõ tên đăng nhập)
    const users = await User.find({ email, emailVerified: false })
      .select('+lastVerifyMailAt').sort({ createdAt: 1 }).limit(MAX_ACCOUNTS_PER_EMAIL);
    for (const user of users) {
      if (onCooldown(user.lastVerifyMailAt)) continue;
      await issueVerification(user).catch((e) => console.error('Không gửi lại được email xác nhận:', e.message));
    }
    return res.status(200).json({ success: true, message: GENERIC_SENT });
  } catch (error) {
    console.error('Lỗi gửi lại email xác nhận:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// [POST] /api/auth/forgot-password  { email }
exports.forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
  try {
    // Một email có thể có nhiều tài khoản: mỗi tài khoản nhận 1 email riêng, trong email ghi tên đăng nhập
    // để người dùng biết đang đặt lại mật khẩu cho tài khoản nào
    const users = await User.find({ email, status: { $ne: 'Locked' } })
      .select('+lastResetMailAt').sort({ createdAt: 1 }).limit(MAX_ACCOUNTS_PER_EMAIL);
    for (const user of users) {
      if (onCooldown(user.lastResetMailAt)) continue;
      const { token, hash } = newToken();
      user.resetPasswordTokenHash = hash;
      user.resetPasswordExpires = new Date(Date.now() + RESET_TTL_MS);
      user.lastResetMailAt = new Date();
      await user.save();
      await mail.sendPasswordResetEmail(user, token).catch((e) => console.error('Không gửi được email đặt lại mật khẩu:', e.message));
    }
    return res.status(200).json({ success: true, message: GENERIC_SENT });
  } catch (error) {
    console.error('Lỗi quên mật khẩu:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// [POST] /api/auth/reset-password  { token, password }
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ success: false, message: 'Link đặt lại mật khẩu không hợp lệ' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 100) {
    return res.status(400).json({ success: false, message: 'Mật khẩu mới phải từ 8 ký tự' });
  }
  try {
    const user = await User.findOne({ resetPasswordTokenHash: hashToken(token) }).select('+resetPasswordExpires');
    if (!user || user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn, hãy yêu cầu link mới' });
    }
    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    user.emailVerified = true; // mở được link trong email = đã chứng minh sở hữu email
    await user.save();
    return res.status(200).json({ success: true, username: user.username, message: 'Đã đặt mật khẩu mới. Hãy đăng nhập lại.' });
  } catch (error) {
    console.error('Lỗi đặt lại mật khẩu:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
