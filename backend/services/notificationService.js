/**
 * notificationService.js
 * Real SMTP email via Nodemailer (reuses the same SMTP config already used
 * for password-reset emails in routes/auth.js).
 * SMS via Twilio when credentials are configured.
 * Both gracefully fall back to console logging in dev so the app
 * never crashes due to missing credentials.
 */

const nodemailer = require('nodemailer');

// ── Shared SMTP transporter (lazy singleton) ──────────────────────────────────
let _transporter = null;
const getTransporter = () => {
  if (_transporter) return _transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;

  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Pool connections so automation alerts don't flood with new connections
    pool: true,
    maxConnections: 3,
  });
  return _transporter;
};

class NotificationService {
  // ── Email ──────────────────────────────────────────────────────────────────
  async sendEmail(to, subject, text, html = null) {
    if (!to) return;

    const transporter = getTransporter();
    if (!transporter) {
      // Dev fallback
      console.log(`[NotifSvc] Mock email → ${to}`);
      console.log(`  Subject : ${subject}`);
      console.log(`  Body    : ${text.slice(0, 120)}…`);
      return;
    }

    try {
      const info = await transporter.sendMail({
        from:    process.env.SMTP_FROM || `"SmartIrrigate SIMS" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        ...(html ? { html } : {}),
      });
      console.log(`[NotifSvc] Email sent to ${to} — msgId: ${info.messageId}`);
    } catch (err) {
      // Never crash the server because of a notification failure
      console.error(`[NotifSvc] Email failed to ${to}:`, err.message);
    }
  }

  // ── HTML alert email helper ────────────────────────────────────────────────
  async sendAlertEmail(to, title, bodyText) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;background:#f4f6f4;margin:0;padding:20px">
          <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;
                      border:1px solid #e2e8e2;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
            <!-- Header -->
            <div style="background:#0d2415;padding:20px 28px;text-align:center">
              <span style="color:#a3e8c6;font-size:1.1rem;font-weight:700">
                💧 SmartIrrigate SIMS
              </span>
            </div>
            <!-- Body -->
            <div style="padding:28px 28px 20px">
              <h2 style="color:#0f172a;font-size:1.1rem;margin:0 0 14px">${title}</h2>
              <p style="color:#475569;font-size:0.95rem;line-height:1.6;margin:0 0 20px">
                ${bodyText}
              </p>
              <hr style="border:none;border-top:1px solid #e2e8e2;margin:20px 0">
              <p style="color:#94a3b8;font-size:0.78rem;margin:0">
                This is an automated alert from SmartIrrigate SIMS.
                You are receiving this because alert notifications are enabled on your account.
              </p>
            </div>
            <!-- Footer -->
            <div style="background:#f8faf8;padding:14px 28px;border-top:1px solid #e2e8e2">
              <span style="color:#94a3b8;font-size:0.75rem">
                © ${new Date().getFullYear()} SIMS — Smart Irrigation Management System
              </span>
            </div>
          </div>
        </body>
      </html>
    `;
    return this.sendEmail(to, title, bodyText, html);
  }

  // ── SMS via Twilio ──────────────────────────────────────────────────────────
  async sendSMS(phoneNumber, message) {
    if (!phoneNumber) return;

    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from  = process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      console.log(`[NotifSvc] Mock SMS → ${phoneNumber}: ${message}`);
      return;
    }

    try {
      // Lazy-load twilio so the app boots even without the package installed
      const twilio = require('twilio');
      const client = twilio(sid, token);
      const msg = await client.messages.create({ body: message, from, to: phoneNumber });
      console.log(`[NotifSvc] SMS sent to ${phoneNumber} — sid: ${msg.sid}`);
    } catch (err) {
      console.error(`[NotifSvc] SMS failed to ${phoneNumber}:`, err.message);
    }
  }

  // ── Convenience: notify user based on their preferences ────────────────────
  async notifyUser(user, subject, text, html = null) {
    if (!user) return;
    if (user.notifyEmail && user.email) {
      await (html
        ? this.sendAlertEmail(user.email, subject, text)
        : this.sendEmail(user.email, subject, text));
    }
  }
}

module.exports = new NotificationService();
