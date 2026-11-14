// File: services/mailService.js
// Gửi email (xác nhận đăng ký, đặt lại mật khẩu).
//   MAIL_PROVIDER=brevo   -> gửi qua Brevo HTTP API (cổng 443). Dùng được trên Render bản miễn phí,
//                            nơi các cổng SMTP 25/465/587 bị chặn. Cần BREVO_API_KEY, MAIL_FROM
//                            (địa chỉ người gửi đã xác minh trong Brevo, có thể là Gmail).
//   MAIL_PROVIDER=console -> (mặc định) không gửi thật, in nội dung + đường link ra log và lưu vào
//                            hộp thư tạm `outbox` (dùng khi chạy máy cá nhân và trong test).
const outbox = []; // chỉ dùng cho chế độ console / test

const provider = () => (process.env.MAIL_PROVIDER || 'console').toLowerCase();
const isRealMailEnabled = () => provider() === 'brevo' && !!process.env.BREVO_API_KEY && !!process.env.MAIL_FROM;

// Địa chỉ trang web (frontend) dùng để tạo link trong email
const appUrl = () => {
  const fromEnv = process.env.APP_URL || (process.env.CORS_ORIGIN || '').split(',')[0];
  return (fromEnv || 'http://localhost:5173').trim().replace(/\/$/, '');
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Khung email chung: tiêu đề, đoạn chữ, 1 nút bấm và link dự phòng
const layout = ({ heading, intro, buttonText, link, note }) => `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f7f6;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e2e8f0">
    <p style="margin:0;font-size:22px;font-weight:800;color:#173b31">Nestly</p>
    <h1 style="font-size:20px;color:#173b31;margin:24px 0 8px">${escapeHtml(heading)}</h1>
    <p style="font-size:14px;line-height:22px;color:#475569;margin:0 0 24px">${intro}</p>
    <a href="${link}" style="display:inline-block;background:#173b31;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:12px">${escapeHtml(buttonText)}</a>
    <p style="font-size:12px;line-height:20px;color:#94a3b8;margin:24px 0 0">${escapeHtml(note)}<br>Nếu nút không bấm được, mở link sau:<br><a href="${link}" style="color:#b7812d;word-break:break-all">${link}</a></p>
  </div>
</div>`;

async function sendWithBrevo({ to, toName, subject, html, text }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      sender: { email: process.env.MAIL_FROM, name: process.env.MAIL_FROM_NAME || 'Nestly' },
      to: [{ email: to, ...(toName ? { name: toName } : {}) }],
      subject,
      htmlContent: html,
      textContent: text
    })
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendMail(mail) {
  if (isRealMailEnabled()) return sendWithBrevo(mail);
  outbox.push({ ...mail, sentAt: new Date() });
  if (outbox.length > 50) outbox.shift();
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[Mail - chưa cấu hình gửi thật] Tới: ${mail.to} | ${mail.subject}\n${mail.text}`);
  }
  return undefined;
}

exports.sendVerificationEmail = (user, token) => {
  const link = `${appUrl()}/verify-email?token=${token}`;
  return sendMail({
    to: user.email,
    toName: user.username,
    subject: 'Xác nhận email đăng ký tài khoản Nestly',
    text: `Chào ${user.username}, bấm link sau để xác nhận email và kích hoạt tài khoản Nestly (hiệu lực 24 giờ): ${link}`,
    html: layout({
      heading: 'Xác nhận email của bạn',
      intro: `Chào <b>${escapeHtml(user.username)}</b>, cảm ơn bạn đã đăng ký Nestly. Bấm nút dưới đây để xác nhận email và kích hoạt tài khoản.`,
      buttonText: 'Xác nhận email',
      link,
      note: 'Link có hiệu lực trong 24 giờ. Nếu bạn không đăng ký tài khoản Nestly, hãy bỏ qua email này.'
    })
  });
};

exports.sendPasswordResetEmail = (user, token) => {
  const link = `${appUrl()}/reset-password?token=${token}`;
  return sendMail({
    to: user.email,
    toName: user.username || user.fullName,
    subject: 'Đặt lại mật khẩu tài khoản Nestly',
    text: `Bấm link sau để đặt mật khẩu mới cho tài khoản Nestly (hiệu lực 30 phút): ${link}`,
    html: layout({
      heading: 'Đặt lại mật khẩu',
      intro: `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <b>${escapeHtml(user.username || user.email)}</b>. Bấm nút dưới đây để tạo mật khẩu mới.`,
      buttonText: 'Đặt mật khẩu mới',
      link,
      note: 'Link có hiệu lực trong 30 phút và chỉ dùng được 1 lần. Nếu bạn không yêu cầu, hãy bỏ qua email này, mật khẩu cũ vẫn giữ nguyên.'
    })
  });
};

exports.isRealMailEnabled = isRealMailEnabled;
exports.outbox = outbox;
exports.appUrl = appUrl;
