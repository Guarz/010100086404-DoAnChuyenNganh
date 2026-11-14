// File: tests/auth.test.js
// Đăng ký bằng tên đăng nhập + email + mật khẩu, xác nhận email, đăng nhập bằng tên đăng nhập,
// quên mật khẩu / đặt lại mật khẩu. Email không gửi thật: lấy link từ hộp thư tạm `outbox`.
process.env.NODE_ENV = 'test';
process.env.MAIL_PROVIDER = 'console';
process.env.EMAIL_VERIFICATION = 'required';
process.env.APP_URL = 'https://nestly-web.example';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { startTestServer } = require('./helpers');
const User = require('../models/User');
const { outbox } = require('../services/mailService');

let ctx;
const tokenFromLastMail = (to, path) => {
  const m = [...outbox].reverse().find((x) => x.to === to);
  assert.ok(m, `phải có email gửi tới ${to}`);
  const match = m.text.match(new RegExp(`https://nestly-web\\.example${path}\\?token=([a-f0-9]{64})`));
  assert.ok(match, `email phải chứa link ${path}`);
  return match[1];
};

before(async () => { ctx = await startTestServer(); });
after(() => ctx.stop());

test('Đăng ký: kiểm tra dữ liệu đầu vào', async () => {
  const bad = [
    { username: 'ab', email: 'a@b.vn', password: '12345678' },
    { username: 'Tên Có Dấu', email: 'a@b.vn', password: '12345678' },
    { username: 'hople', email: 'khong-phai-email', password: '12345678' },
    { username: 'hople', email: 'a@b.vn', password: '123' }
  ];
  for (const body of bad) {
    const res = await ctx.api('POST', '/auth/register', { body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test('Đăng ký -> gửi email xác nhận, chưa xác nhận thì chưa đăng nhập được', async () => {
  const res = await ctx.api('POST', '/auth/register', { body: { username: 'Minh.An', email: 'MinhAn@Gmail.com', password: 'matkhau123' } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.requiresVerification, true);
  assert.equal(res.body.mailSent, true);

  const user = await User.findOne({ username: 'minh.an' }).select('+emailVerifyTokenHash');
  assert.equal(user.email, 'minhan@gmail.com');
  assert.equal(user.emailVerified, false);
  assert.ok(user.emailVerifyTokenHash, 'chỉ lưu mã băm của token');
  assert.equal(user.fullName, 'minh.an');

  const login = await ctx.api('POST', '/auth/login', { body: { username: 'minh.an', password: 'matkhau123' } });
  assert.equal(login.status, 403);
  assert.equal(login.body.code, 'EMAIL_NOT_VERIFIED');
  assert.equal(login.body.token, undefined);
});

test('Trùng tên đăng nhập / email -> 409', async () => {
  let res = await ctx.api('POST', '/auth/register', { body: { username: 'minh.an', email: 'khac@gmail.com', password: 'matkhau123' } });
  assert.equal(res.status, 409);
  assert.equal(res.body.field, 'username');
  res = await ctx.api('POST', '/auth/register', { body: { username: 'nguoikhac', email: 'minhan@gmail.com', password: 'matkhau123' } });
  assert.equal(res.status, 409);
  assert.equal(res.body.field, 'email');
});

test('Bấm link xác nhận -> đăng nhập được bằng tên đăng nhập; link chỉ dùng 1 lần', async () => {
  const token = tokenFromLastMail('minhan@gmail.com', '/verify-email');
  const ok = await ctx.api('POST', '/auth/verify-email', { body: { token } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const again = await ctx.api('POST', '/auth/verify-email', { body: { token } });
  assert.equal(again.status, 400);

  const login = await ctx.api('POST', '/auth/login', { body: { username: 'Minh.An', password: 'matkhau123' } });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.ok(login.body.token);
  assert.equal(login.body.user.username, 'minh.an');
  for (const secret of ['password', 'emailVerifyTokenHash', 'resetPasswordTokenHash', 'lastVerifyMailAt', 'lastResetMailAt']) {
    assert.equal(login.body.user[secret], undefined, `không trả ${secret}`);
  }

  const wrong = await ctx.api('POST', '/auth/login', { body: { username: 'minh.an', password: 'saimatkhau' } });
  assert.equal(wrong.status, 400);
});

test('Tài khoản cũ (chưa có tên đăng nhập, không có emailVerified) vẫn đăng nhập bằng email', async () => {
  await User.create({ fullName: 'Khách Cũ', email: 'khachcu@test.vn', password: await bcrypt.hash('matkhau123', 10) });
  const login = await ctx.api('POST', '/auth/login', { body: { username: 'khachcu@test.vn', password: 'matkhau123' } });
  assert.equal(login.status, 200, JSON.stringify(login.body));
});

test('Gửi lại email xác nhận: trả lời chung, giới hạn 60 giây', async () => {
  await ctx.api('POST', '/auth/register', { body: { username: 'chua_xac_nhan', email: 'cxn@test.vn', password: 'matkhau123' } });
  const before = outbox.length;
  const res = await ctx.api('POST', '/auth/resend-verification', { body: { email: 'cxn@test.vn' } });
  assert.equal(res.status, 200);
  assert.equal(outbox.length, before, 'vừa gửi lúc đăng ký -> chưa gửi lại trong 60 giây');

  await User.updateOne({ email: 'cxn@test.vn' }, { $set: { lastVerifyMailAt: new Date(Date.now() - 61000) } });
  await ctx.api('POST', '/auth/resend-verification', { body: { email: 'cxn@test.vn' } });
  assert.equal(outbox.length, before + 1);

  const unknown = await ctx.api('POST', '/auth/resend-verification', { body: { email: 'khongco@test.vn' } });
  assert.equal(unknown.status, 200, 'không lộ email nào đã đăng ký');
  assert.equal(unknown.body.message, res.body.message);
});

test('Quên mật khẩu -> email có link -> đặt mật khẩu mới -> đăng nhập bằng mật khẩu mới', async () => {
  await User.updateOne({ email: 'minhan@gmail.com' }, { $unset: { lastResetMailAt: 1 } });
  const res = await ctx.api('POST', '/auth/forgot-password', { body: { email: 'MinhAn@gmail.com' } });
  assert.equal(res.status, 200);
  const token = tokenFromLastMail('minhan@gmail.com', '/reset-password');

  const weak = await ctx.api('POST', '/auth/reset-password', { body: { token, password: '123' } });
  assert.equal(weak.status, 400);

  const ok = await ctx.api('POST', '/auth/reset-password', { body: { token, password: 'matkhaumoi456' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const reuse = await ctx.api('POST', '/auth/reset-password', { body: { token, password: 'matkhaukhac789' } });
  assert.equal(reuse.status, 400, 'link chỉ dùng 1 lần');

  const oldPass = await ctx.api('POST', '/auth/login', { body: { username: 'minh.an', password: 'matkhau123' } });
  assert.equal(oldPass.status, 400);
  const newPass = await ctx.api('POST', '/auth/login', { body: { username: 'minh.an', password: 'matkhaumoi456' } });
  assert.equal(newPass.status, 200);
});

test('Link đặt lại mật khẩu hết hạn sau 30 phút; email lạ vẫn trả lời chung', async () => {
  await User.updateOne({ email: 'minhan@gmail.com' }, { $unset: { lastResetMailAt: 1 } });
  await ctx.api('POST', '/auth/forgot-password', { body: { email: 'minhan@gmail.com' } });
  const token = tokenFromLastMail('minhan@gmail.com', '/reset-password');
  await User.updateOne({ email: 'minhan@gmail.com' }, { $set: { resetPasswordExpires: new Date(Date.now() - 1000) } });
  const expired = await ctx.api('POST', '/auth/reset-password', { body: { token, password: 'matkhaumoi999' } });
  assert.equal(expired.status, 400);
  assert.equal(expired.body.code, 'TOKEN_EXPIRED');

  const before = outbox.length;
  const unknown = await ctx.api('POST', '/auth/forgot-password', { body: { email: 'khongco@test.vn' } });
  assert.equal(unknown.status, 200);
  assert.equal(outbox.length, before);
});

test('Tắt xác nhận email (EMAIL_VERIFICATION=off) -> đăng ký xong đăng nhập ngay', async () => {
  process.env.EMAIL_VERIFICATION = 'off';
  try {
    const res = await ctx.api('POST', '/auth/register', { body: { username: 'khong_can_xn', email: 'kcx@test.vn', password: 'matkhau123' } });
    assert.equal(res.status, 201);
    assert.equal(res.body.requiresVerification, false);
    const login = await ctx.api('POST', '/auth/login', { body: { username: 'khong_can_xn', password: 'matkhau123' } });
    assert.equal(login.status, 200);
  } finally {
    process.env.EMAIL_VERIFICATION = 'required';
  }
});

test('Vừa đăng ký xong vẫn yêu cầu quên mật khẩu được ngay (bộ đếm 60 giây riêng từng loại email)', async () => {
  await ctx.api('POST', '/auth/register', { body: { username: 'vua_dang_ky', email: 'vdk@test.vn', password: 'matkhau123' } });
  const before = outbox.length;
  await ctx.api('POST', '/auth/forgot-password', { body: { email: 'vdk@test.vn' } });
  assert.equal(outbox.length, before + 1);
  tokenFromLastMail('vdk@test.vn', '/reset-password');
  await ctx.api('POST', '/auth/forgot-password', { body: { email: 'vdk@test.vn' } });
  assert.equal(outbox.length, before + 1, 'gửi lần 2 trong 60 giây bị bỏ qua');
});
