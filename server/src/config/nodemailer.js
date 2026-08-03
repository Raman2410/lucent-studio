"use strict";

const nodemailer = require("nodemailer");

// ─────────────────────────────────────────
// TRANSPORTER SETUP
// ─────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD, // Gmail App Password — not account password
  },
  pool: true, // reuse connections instead of creating new per email
  maxConnections: 5, // max 5 simultaneous connections
  maxMessages: 100, // max 100 messages per connection
});

// ─────────────────────────────────────────
// VERIFY TRANSPORTER ON STARTUP
// ─────────────────────────────────────────
const verifyTransporter = async () => {
  try {
    await transporter.verify();
    console.log("✅ Nodemailer transporter ready → Gmail SMTP");
  } catch (error) {
    console.error("❌ Nodemailer verification failed:", error.message);
    console.warn(
      "⚠️  Email notifications will not work. Check SMTP credentials.",
    );
  }
};

// ─────────────────────────────────────────
// BASE EMAIL TEMPLATE
// consistent branding across all emails
// ─────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Photographer Studio</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f4f4; color: #333; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1a1a2e; padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 22px; font-weight: 600; letter-spacing: 1px; }
    .header p { color: #c8b8a2; font-size: 13px; margin-top: 4px; }
    .body { padding: 40px; }
    .body h2 { font-size: 20px; color: #1a1a2e; margin-bottom: 16px; }
    .body p { font-size: 15px; line-height: 1.7; color: #555; margin-bottom: 12px; }
    .info-box { background: #f9f9f9; border-left: 4px solid #c8b8a2; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
    .info-box p { margin: 0; font-size: 14px; color: #444; line-height: 1.8; }
    .info-box strong { color: #1a1a2e; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 12px 0; }
    .badge-pending    { background: #fff3cd; color: #856404; }
    .badge-confirmed  { background: #d1e7dd; color: #0f5132; }
    .badge-cancelled  { background: #f8d7da; color: #842029; }
    .badge-completed  { background: #cfe2ff; color: #084298; }
    .badge-refund     { background: #e2d9f3; color: #3d1a78; }
    .divider { border: none; border-top: 1px solid #eee; margin: 24px 0; }
    .footer { background: #f9f9f9; padding: 24px 40px; text-align: center; }
    .footer p { font-size: 12px; color: #999; line-height: 1.6; }
    .footer a { color: #1a1a2e; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>📸 Photographer Studio</h1>
      <p>Professional Photography & Equipment Rental</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <hr class="divider" />
    <div class="footer">
      <p>© ${new Date().getFullYear()} Photographer Studio. All rights reserved.</p>
      <p>Questions? <a href="mailto:${process.env.SMTP_EMAIL}">Contact us</a></p>
    </div>
  </div>
</body>
</html>
`;

// ─────────────────────────────────────────
// EMAIL TEMPLATES
// ─────────────────────────────────────────

const templates = {
  // 1. BOOKING CONFIRMATION
  bookingConfirmation: (data) => ({
    subject: `Booking Confirmed — #${data.bookingId}`,
    html: baseTemplate(`
      <h2>Your Booking is Confirmed! 🎉</h2>
      <p>Hi <strong>${data.userName}</strong>, thank you for booking with us.</p>
      <div class="info-box">
        <p><strong>Booking ID:</strong> #${data.bookingId}</p>
        <p><strong>Service:</strong> ${data.serviceName}</p>
        <p><strong>Date:</strong> ${data.date}</p>
        <p><strong>Time:</strong> ${data.time || "To be confirmed"}</p>
        <p><strong>Location:</strong> ${data.location || "To be confirmed"}</p>
        <p><strong>Amount Paid:</strong> ₹${data.amount}</p>
      </div>
      <span class="badge badge-confirmed">✅ Confirmed</span>
      <p>We will reach out to you 24 hours before your session with further details.</p>
      <p>If you have any questions, feel free to contact us or use our AI chatbot on the website.</p>
    `),
  }),

  // 2. PAYMENT RECEIPT
  paymentReceipt: (data) => ({
    subject: `Payment Receipt — ₹${data.amount} — #${data.bookingId}`,
    html: baseTemplate(`
      <h2>Payment Received 💳</h2>
      <p>Hi <strong>${data.userName}</strong>, we have received your payment.</p>
      <div class="info-box">
        <p><strong>Booking ID:</strong> #${data.bookingId}</p>
        <p><strong>Razorpay Payment ID:</strong> ${data.paymentId}</p>
        <p><strong>Amount:</strong> ₹${data.amount}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
        <p><strong>Status:</strong> Successful</p>
      </div>
      <span class="badge badge-confirmed">✅ Payment Successful</span>
      <p>Please save this email as your payment receipt. Your booking is now confirmed.</p>
    `),
  }),

  // 3. RESCHEDULE CONFIRMATION
  rescheduleConfirmation: (data) => ({
    subject: `Booking Rescheduled — #${data.bookingId}`,
    html: baseTemplate(`
      <h2>Booking Rescheduled 📅</h2>
      <p>Hi <strong>${data.userName}</strong>, your booking has been successfully rescheduled.</p>
      <div class="info-box">
        <p><strong>Booking ID:</strong> #${data.bookingId}</p>
        <p><strong>Service:</strong> ${data.serviceName}</p>
        <p><strong>Previous Date:</strong> <s>${data.oldDate}</s></p>
        <p><strong>New Date:</strong> ${data.newDate}</p>
      </div>
      <span class="badge badge-confirmed">✅ Rescheduled</span>
      <p>If you did not request this change or need further assistance, please contact us immediately.</p>
    `),
  }),

  // 4. CANCELLATION + REFUND INITIATED
  cancellationAndRefund: (data) => ({
    subject: `Booking Cancelled & Refund Initiated — #${data.bookingId}`,
    html: baseTemplate(`
      <h2>Booking Cancelled 😔</h2>
      <p>Hi <strong>${data.userName}</strong>, your booking has been cancelled as requested.</p>
      <div class="info-box">
        <p><strong>Booking ID:</strong> #${data.bookingId}</p>
        <p><strong>Service:</strong> ${data.serviceName}</p>
        <p><strong>Cancelled On:</strong> ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
        <p><strong>Refund Amount:</strong> ₹${data.refundAmount}</p>
        <p><strong>Refund To:</strong> Original payment method</p>
        <p><strong>Expected Timeline:</strong> 5–7 business days</p>
      </div>
      <span class="badge badge-refund">💜 Refund Initiated</span>
      <p>The refund has been initiated via Razorpay and will reflect in your account within 5–7 business days.</p>
      <p>We hope to serve you again soon.</p>
    `),
  }),

  // 5. REMINDER 24HRS BEFORE SHOOT
  shootReminder: (data) => ({
    subject: `Reminder: Your Session is Tomorrow! 📸 — #${data.bookingId}`,
    html: baseTemplate(`
      <h2>Your Session is Tomorrow! 🌟</h2>
      <p>Hi <strong>${data.userName}</strong>, just a friendly reminder about your upcoming session.</p>
      <div class="info-box">
        <p><strong>Booking ID:</strong> #${data.bookingId}</p>
        <p><strong>Service:</strong> ${data.serviceName}</p>
        <p><strong>Date:</strong> ${data.date}</p>
        <p><strong>Time:</strong> ${data.time || "To be confirmed"}</p>
        <p><strong>Location:</strong> ${data.location || "To be confirmed"}</p>
      </div>
      <span class="badge badge-confirmed">📸 See You Tomorrow!</span>
      <p>Please make sure you are ready 10 minutes before the session start time.</p>
      <p>If you need to reschedule or have any last-minute questions, contact us immediately.</p>
    `),
  }),

  // 6. QUERY RECEIVED ACKNOWLEDGEMENT
  queryAcknowledgement: (data) => ({
    subject: `We Received Your Query — #${data.queryId}`,
    html: baseTemplate(`
      <h2>Query Received! 💬</h2>
      <p>Hi <strong>${data.userName}</strong>, thank you for reaching out to us.</p>
      <div class="info-box">
        <p><strong>Query ID:</strong> #${data.queryId}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <p><strong>Submitted On:</strong> ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
        <p><strong>Status:</strong> Under Review</p>
      </div>
      <span class="badge badge-pending">🕐 Under Review</span>
      <p>Our team will review your query and respond within <strong>24–48 hours</strong>.</p>
      <p>In the meantime, you can also use our AI chatbot on the website for instant answers to common questions.</p>
    `),
  }),

  // 7. PASSWORD RESET
  passwordReset: (data) => ({
    subject: "Reset Your Password — Photographer Studio",
    html: baseTemplate(`
      <h2>Reset Your Password 🔒</h2>
      <p>Hi <strong>${data.userName}</strong>, we received a request to reset your password.</p>
      <div class="info-box">
        <p>Click the button below to choose a new password. This link is valid for <strong>15 minutes</strong>.</p>
      </div>
      <p style="text-align:center; margin: 28px 0;">
        <a href="${data.resetURL}" style="display:inline-block; background:#1a1a2e; color:#fff; text-decoration:none; padding:14px 32px; border-radius:6px; font-size:14px; font-weight:600;">
          Reset Password
        </a>
      </p>
      <p style="font-size:12.5px; color:#999;">If the button doesn't work, copy and paste this link into your browser:<br/>${data.resetURL}</p>
      <p>If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
    `),
  }),

  // 8. EMAIL VERIFICATION
  emailVerification: (data) => ({
    subject: "Verify Your Email — Photographer Studio",
    html: baseTemplate(`
      <h2>Welcome, ${data.userName}! 👋</h2>
      <p>Thanks for creating an account. Please confirm this is your email address.</p>
      <div class="info-box">
        <p>Click the button below to verify your email. This link is valid for <strong>24 hours</strong>.</p>
      </div>
      <p style="text-align:center; margin: 28px 0;">
        <a href="${data.verifyURL}" style="display:inline-block; background:#1a1a2e; color:#fff; text-decoration:none; padding:14px 32px; border-radius:6px; font-size:14px; font-weight:600;">
          Verify Email
        </a>
      </p>
      <p style="font-size:12.5px; color:#999;">If the button doesn't work, copy and paste this link into your browser:<br/>${data.verifyURL}</p>
      <p>You can still browse and book while unverified — this just confirms we can reach you.</p>
    `),
  }),

  // 9. PASSWORD CHANGED CONFIRMATION
  passwordChanged: (data) => ({
    subject: "Your Password Was Changed — Photographer Studio",
    html: baseTemplate(`
      <h2>Password Changed ✅</h2>
      <p>Hi <strong>${data.userName}</strong>, this is a confirmation that your account password was just changed.</p>
      <div class="info-box">
        <p><strong>When:</strong> ${new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}</p>
      </div>
      <p>If you made this change, no further action is needed.</p>
      <p>If you did <strong>not</strong> make this change, please contact us immediately and reset your password.</p>
    `),
  }),
};

// ─────────────────────────────────────────
// SEND EMAIL — core function
// ─────────────────────────────────────────

/**
 * Send an email using a predefined template
 * @param {string} to — recipient email
 * @param {string} templateName — key from templates object
 * @param {object} data — dynamic data for the template
 */
const sendEmail = async (to, templateName, data) => {
  try {
    const template = templates[templateName];

    if (!template) {
      throw new Error(`Email template "${templateName}" not found`);
    }

    const { subject, html } = template(data);

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent [${templateName}] → ${to} (${info.messageId})`);

    return info;
  } catch (error) {
    // email failure is non-fatal — log but don't crash the request
    console.error(
      `❌ Email send failed [${templateName}] → ${to}:`,
      error.message,
    );
  }
};

module.exports = {
  transporter,
  verifyTransporter,
  sendEmail,
  templates,
};
