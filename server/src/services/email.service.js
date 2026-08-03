"use strict";

const { sendEmail } = require("../config/nodemailer");

// ─────────────────────────────────────────
// EMAIL SERVICE
// clean trigger functions for every email
// controllers call these — never call
// sendEmail() directly from controllers
//
// all functions are fire-and-forget
// email failure never crashes the request
// ─────────────────────────────────────────

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/**
 * Format a booking's date + time for email display.
 * Multi-day bookings (wedding date ranges, multi-day rentals) show
 * a "start – end" range instead of a single date + time slot.
 * @param {object} booking
 * @returns {string}
 */
const formatBookingWhen = (booking) => {
  if (booking.isMultiDay && booking.endDate) {
    return `${formatDate(booking.date)} – ${formatDate(booking.endDate)}`;
  }
  return `${formatDate(booking.date)}${booking.time ? ` at ${booking.time}` : ""}`;
};

/**
 * Send booking confirmation email
 * Triggered: after booking is created + payment confirmed
 *
 * @param {object} user    — { name, email }
 * @param {object} booking — booking document
 */
const sendBookingConfirmation = async (user, booking) => {
  await sendEmail(user.email, "bookingConfirmation", {
    bookingId: booking.bookingRef || booking._id,
    userName: user.name,
    serviceName:
      booking.type === "photography"
        ? booking.packageSnapshot?.name || "Photography Session"
        : `${booking.cameraSnapshot?.brand} ${booking.cameraSnapshot?.name} Rental`,
    date: booking.isMultiDay ? formatBookingWhen(booking) : formatDate(booking.date),
    time: booking.isMultiDay ? "" : booking.time,
    location: booking.location || "To be confirmed",
    amount: booking.amount.total.toLocaleString("en-IN"),
  });
};

/**
 * Send payment receipt email
 * Triggered: immediately after Razorpay payment verification
 *
 * @param {object} user      — { name, email }
 * @param {object} booking   — booking document
 * @param {string} paymentId — razorpay_payment_id
 */
const sendPaymentReceipt = async (user, booking, paymentId) => {
  await sendEmail(user.email, "paymentReceipt", {
    bookingId: booking.bookingRef || booking._id,
    userName: user.name,
    paymentId,
    amount: booking.amount.total.toLocaleString("en-IN"),
  });
};

/**
 * Send reschedule confirmation email
 * Triggered: after successful reschedule within 24hrs
 *
 * @param {object} user    — { name, email }
 * @param {object} booking — booking document
 * @param {string} oldDate — previous shoot date
 * @param {string} oldTime — previous shoot time
 */
const sendRescheduleConfirmation = async (user, booking, oldDate, oldTime) => {
  await sendEmail(user.email, "rescheduleConfirmation", {
    bookingId: booking.bookingRef || booking._id,
    userName: user.name,
    serviceName:
      booking.type === "photography"
        ? booking.packageSnapshot?.name || "Photography Session"
        : `${booking.cameraSnapshot?.brand} ${booking.cameraSnapshot?.name} Rental`,
    oldDate: `${formatDate(oldDate)} at ${oldTime}`,
    newDate: formatBookingWhen(booking),
  });
};

/**
 * Send cancellation + refund initiated email
 * Triggered: after booking cancellation & refund initiation
 *
 * @param {object} user         — { name, email }
 * @param {object} booking      — booking document
 * @param {number} refundAmount — amount refunded in INR
 */
const sendCancellationAndRefund = async (user, booking, refundAmount) => {
  await sendEmail(user.email, "cancellationAndRefund", {
    bookingId: booking.bookingRef || booking._id,
    userName: user.name,
    serviceName:
      booking.type === "photography"
        ? booking.packageSnapshot?.name || "Photography Session"
        : `${booking.cameraSnapshot?.brand} ${booking.cameraSnapshot?.name} Rental`,
    refundAmount: refundAmount.toLocaleString("en-IN"),
  });
};

/**
 * Send 24hr shoot reminder email
 * Triggered: by reminder scheduler — 24hrs before shoot date
 *
 * @param {object} user    — { name, email }
 * @param {object} booking — booking document
 */
const sendShootReminder = async (user, booking) => {
  await sendEmail(user.email, "shootReminder", {
    bookingId: booking.bookingRef || booking._id,
    userName: user.name,
    serviceName:
      booking.type === "photography"
        ? booking.packageSnapshot?.name || "Photography Session"
        : `${booking.cameraSnapshot?.brand} ${booking.cameraSnapshot?.name} Rental`,
    date: booking.isMultiDay ? formatBookingWhen(booking) : formatDate(booking.date),
    time: booking.isMultiDay ? "" : booking.time,
    location: booking.location || "To be confirmed",
  });
};

/**
 * Send query acknowledgement email
 * Triggered: immediately after user submits a query
 *
 * @param {object} user  — { name, email }
 * @param {object} query — query document
 */
const sendQueryAcknowledgement = async (user, query) => {
  await sendEmail(user.email, "queryAcknowledgement", {
    queryId: query.queryRef || query._id,
    userName: user.name,
    subject: query.subject,
  });
};

// ─────────────────────────────────────────
// REMINDER SCHEDULER
// checks for bookings due tomorrow
// sends reminder email if not yet sent
// call this via a cron job or setInterval
//
// recommended: run every hour
// setInterval(runReminderScheduler, 60 * 60 * 1000)
// ─────────────────────────────────────────

/**
 * Send email verification link
 * Triggered: after register, or on-demand via /resend-verification
 *
 * @param {object} user      — { name, email }
 * @param {string} verifyURL — frontend URL containing the plain verification token
 */
const sendEmailVerification = async (user, verifyURL) => {
  await sendEmail(user.email, "emailVerification", {
    userName: user.name,
    verifyURL,
  });
};

/**
 * Send password reset email
 * Triggered: after user requests a password reset via /forgot-password
 *
 * @param {object} user     — { name, email }
 * @param {string} resetURL — frontend URL containing the plain reset token
 */
const sendPasswordReset = async (user, resetURL) => {
  await sendEmail(user.email, "passwordReset", {
    userName: user.name,
    resetURL,
  });
};

/**
 * Send password changed confirmation email
 * Triggered: after a successful password reset or change-password
 *
 * @param {object} user — { name, email }
 */
const sendPasswordChanged = async (user) => {
  await sendEmail(user.email, "passwordChanged", {
    userName: user.name,
  });
};

/**
 * Run the reminder scheduler
 * Finds bookings due tomorrow and sends reminder emails
 * Marks reminderSent = true to prevent duplicates
 */
const runReminderScheduler = async () => {
  try {
    const Booking = require("../models/Booking.model");

    const dueBookings = await Booking.getDueForReminder();

    if (dueBookings.length === 0) {
      console.log("📅 Reminder scheduler: no bookings due tomorrow");
      return;
    }

    console.log(
      `📅 Reminder scheduler: sending ${dueBookings.length} reminder(s)`,
    );

    for (const booking of dueBookings) {
      try {
        await sendShootReminder(booking.user, booking);

        // mark as sent — prevents duplicate emails on next scheduler run
        booking.reminderSent = true;
        await booking.save();

        console.log(
          `✅ Reminder sent → ${booking.user.email} | Booking: ${booking.bookingRef}`,
        );
      } catch (err) {
        console.error(
          `❌ Reminder failed for booking ${booking._id}:`,
          err.message,
        );
        // continue to next booking even if one fails
      }
    }
  } catch (error) {
    console.error("❌ Reminder scheduler error:", error.message);
  }
};

/**
 * Start the reminder scheduler
 * Called once in server.js after DB connects
 * Runs every hour
 */
const startReminderScheduler = () => {
  console.log("⏰ Reminder scheduler started (runs every hour)");

  // run immediately on startup to catch any missed reminders
  runReminderScheduler();

  // then run every hour
  setInterval(runReminderScheduler, 60 * 60 * 1000);
};

module.exports = {
  sendBookingConfirmation,
  sendPaymentReceipt,
  sendRescheduleConfirmation,
  sendCancellationAndRefund,
  sendShootReminder,
  sendQueryAcknowledgement,
  sendEmailVerification,
  sendPasswordReset,
  sendPasswordChanged,
  runReminderScheduler,
  startReminderScheduler,
};
