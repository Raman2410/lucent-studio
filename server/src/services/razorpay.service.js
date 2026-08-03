"use strict";

const {
  createOrder,
  verifyPaymentSignature,
  initiateRefund,
  fetchPayment,
  checkRefundEligibility,
  toINR,
} = require("../config/razorpay");
const Booking = require("../models/Booking.model");
const Availability = require("../models/Availability.model");
const { cacheDeletePattern, CACHE_KEYS } = require("../config/redis");
const {
  sendPaymentReceipt,
  sendBookingConfirmation,
  sendCancellationAndRefund,
} = require("./email.service");
const { emitBookingConfirmed, emitBookingCancelled } = require("../socket");
const { notifyAdmins, notifyUser } = require("./notification.service");
const { AppError } = require("../middlewares/error.middleware");
const { STATUS } = require("../utils/apiResponse");

// ─────────────────────────────────────────
// CREATE PAYMENT ORDER
// step 1 of payment flow
// creates Razorpay order for a booking
// ─────────────────────────────────────────

/**
 * Create a Razorpay order for a booking
 * @param {string} bookingId — MongoDB booking _id
 * @returns {object} { orderId, amount, currency, bookingRef }
 */
const createPaymentOrder = async (bookingId) => {
  // 1. fetch booking
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError("Booking not found", STATUS.NOT_FOUND);
  }

  // 2. check booking is in Pending state
  if (booking.status !== "Pending") {
    throw new AppError(
      `Cannot create payment for booking with status: ${booking.status}`,
      STATUS.BAD_REQUEST,
    );
  }

  // 3. check booking date is still in future
  if (new Date(booking.date) < new Date()) {
    throw new AppError(
      "Cannot pay for a booking with a past date",
      STATUS.BAD_REQUEST,
    );
  }

  // 4. create Razorpay order
  const order = await createOrder(booking.amount.total, booking._id, {
    bookingRef: booking.bookingRef,
    type: booking.type,
  });

  // 5. store order ID on booking
  booking.payment.razorpayOrderId = order.id;
  await booking.save();

  return {
    orderId: order.id,
    amount: order.amount, // in paise
    amountINR: booking.amount.total,
    currency: order.currency,
    bookingRef: booking.bookingRef,
    bookingId: booking._id,
  };
};

// ─────────────────────────────────────────
// VERIFY PAYMENT & CONFIRM BOOKING
// step 2 of payment flow
// verifies Razorpay signature + confirms booking
// ─────────────────────────────────────────

/**
 * Verify Razorpay payment and confirm booking
 * @param {string} razorpay_order_id
 * @param {string} razorpay_payment_id
 * @param {string} razorpay_signature
 * @param {string} bookingId
 * @param {object} io — Socket.io instance for real-time update
 * @returns {object} confirmed booking
 */
const verifyAndConfirmPayment = async (
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  bookingId,
  io = null,
) => {
  // 1. verify signature — CRITICAL security step
  const isValid = verifyPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );

  if (!isValid) {
    throw new AppError(
      "Payment verification failed. Invalid signature.",
      STATUS.BAD_REQUEST,
    );
  }

  // 2. fetch booking
  const booking = await Booking.findById(bookingId).populate(
    "user",
    "name email",
  );

  if (!booking) {
    throw new AppError("Booking not found", STATUS.NOT_FOUND);
  }

  // 2b. cross-check the order actually belongs to THIS booking.
  // verifyPaymentSignature only proves order_id/payment_id are a genuine
  // matching pair from Razorpay — it says nothing about which booking they
  // were created for. Without this check, a valid signature from any paid
  // order (e.g. the caller's own cheap booking) could be replayed here with
  // a different bookingId to confirm it as paid.
  if (booking.payment?.razorpayOrderId !== razorpay_order_id) {
    throw new AppError(
      "This payment does not match the order created for this booking.",
      STATUS.BAD_REQUEST,
    );
  }

  // 3. check booking is still Pending
  // (handles duplicate webhook/callback calls)
  if (booking.status === "Confirmed") {
    return booking; // already confirmed — idempotent
  }

  if (booking.status !== "Pending") {
    throw new AppError(
      `Cannot confirm booking with status: ${booking.status}`,
      STATUS.BAD_REQUEST,
    );
  }

  // 4. fetch payment details from Razorpay for method info
  let paymentMethod = null;
  try {
    const paymentDetails = await fetchPayment(razorpay_payment_id);
    paymentMethod = paymentDetails.method; // "card", "upi", "netbanking"
  } catch {
    // non-critical — continue without method info
  }

  // 5. update payment details on booking
  booking.payment.razorpayPaymentId = razorpay_payment_id;
  booking.payment.razorpaySignature = razorpay_signature;
  booking.payment.paidAt = new Date();
  booking.payment.method = paymentMethod;

  // 6. update status: Pending → Payment Done → Confirmed
  await booking.updateStatus("Payment Done", "Payment received via Razorpay");
  await booking.updateStatus(
    "Confirmed",
    "Auto-confirmed after payment verification",
  );

  // 7. update availability calendar
  try {
    if (booking.isMultiDay && booking.endDate) {
      await Availability.addBookingRange(
        booking.date,
        booking.endDate,
        booking._id,
        booking.type,
        booking.availabilityScope,
      );
    } else {
      const availability = await Availability.getOrCreate(
        booking.date,
        booking.availabilityScope,
      );
      await availability.addBooking(booking._id, booking.type, booking.time);
    }

    // invalidate Redis availability cache
    await cacheDeletePattern(`${CACHE_KEYS.availability("")}*`);
  } catch (err) {
    console.error("⚠️  Availability update failed:", err.message);
    // non-critical — booking is confirmed, availability will sync
  }

  // 8. send emails (fire-and-forget)
  sendPaymentReceipt(booking.user, booking, razorpay_payment_id);
  sendBookingConfirmation(booking.user, booking);

  // 9. emit real-time WebSocket event
  if (io) {
    emitBookingConfirmed(io, booking._id, booking.user._id, {
      bookingRef: booking.bookingRef,
      date: booking.date,
      amount: booking.amount.total,
    });
  }

  // 10. in-app notifications — fire-and-forget, never block confirmation
  notifyAdmins(
    io,
    "payment_received",
    "Payment Received",
    `₹${booking.amount.total} received from ${booking.user.name} for ${booking.bookingRef}`,
    { bookingId: booking._id, bookingRef: booking.bookingRef },
  );
  notifyUser(
    io,
    booking.user._id,
    "booking_confirmed",
    "Booking Confirmed",
    `Your booking ${booking.bookingRef} is confirmed for ${new Date(booking.date).toDateString()}`,
    { bookingId: booking._id, bookingRef: booking.bookingRef },
  );

  console.log(
    `✅ Payment verified + Booking confirmed → ${booking.bookingRef} | ₹${booking.amount.total}`,
  );

  return booking;
};

// ─────────────────────────────────────────
// PROCESS REFUND
// called from booking cancellation flow
// checks eligibility → initiates refund → updates booking
// ─────────────────────────────────────────

/**
 * Process cancellation and refund for a booking
 * @param {string} bookingId
 * @param {string} userId     — requesting user (ownership check, skipped for admin)
 * @param {string} reason     — cancellation reason
 * @param {object} io         — Socket.io instance
 * @param {object} options    — { isAdmin: bool } — admin can cancel any booking
 * @returns {object} { booking, refundAmount, refundInitiated }
 */
const processCancellationRefund = async (
  bookingId,
  userId,
  reason = "",
  io = null,
  options = {},
) => {
  const { isAdmin = false } = options;

  // 1. fetch booking with user
  const booking = await Booking.findById(bookingId).populate(
    "user",
    "name email",
  );

  if (!booking) {
    throw new AppError("Booking not found", STATUS.NOT_FOUND);
  }

  // 2. ownership check — user can only cancel their own booking.
  // admins are allowed to cancel any booking on the customer's behalf.
  if (!isAdmin && booking.user._id.toString() !== userId.toString()) {
    throw new AppError(
      "You are not authorized to cancel this booking",
      STATUS.FORBIDDEN,
    );
  }

  // 3. check booking is cancellable
  if (!booking.isCancellable) {
    throw new AppError(
      `Booking cannot be cancelled at this stage. Current status: ${booking.status}`,
      STATUS.BAD_REQUEST,
    );
  }

  let refundAmount = 0;
  let refundInitiated = false;
  let razorpayRefundId = null;

  // 4. process refund if payment was made
  if (booking.payment.razorpayPaymentId && booking.status !== "Pending") {
    // check refund eligibility (48hr policy)
    const eligibility = booking.checkRefundEligibility();

    if (eligibility.eligible) {
      try {
        // full refund
        refundAmount = booking.amount.total;

        const refund = await initiateRefund(
          booking.payment.razorpayPaymentId,
          refundAmount,
          { bookingRef: booking.bookingRef, reason },
        );

        razorpayRefundId = refund.id;
        refundInitiated = true;

        console.log(
          `✅ Refund initiated → ${refund.id} | ₹${refundAmount} for ${booking.bookingRef}`,
        );
      } catch (err) {
        console.error("❌ Refund initiation failed:", err.message);
        // continue with cancellation even if refund fails
        // team can manually process refund
      }
    } else {
      console.log(
        `⚠️  Refund not eligible for ${booking.bookingRef} — only ${eligibility.hoursLeft}hrs left`,
      );
    }
  }

  // 5. update refund details on booking
  booking.refund = {
    razorpayRefundId,
    amount: refundAmount,
    status: refundInitiated ? "initiated" : "none",
    initiatedAt: refundInitiated ? new Date() : null,
    reason,
  };

  // 6. update cancellation details
  booking.cancellation = {
    cancelledAt: new Date(),
    reason,
    cancelledBy: isAdmin ? "admin" : "user",
  };

  // 7. update booking status
  await booking.updateStatus(
    "Cancelled",
    `Cancelled by ${isAdmin ? "admin" : "user"}. ${refundInitiated ? `Refund of ₹${refundAmount} initiated.` : "No refund applicable."}`,
  );

  // 8. update availability — free up the slot(s)
  try {
    if (booking.isMultiDay && booking.endDate) {
      await Availability.removeBookingRange(
        booking.date,
        booking.endDate,
        booking._id,
        booking.availabilityScope,
      );
    } else {
      const availability = await Availability.findOne({
        date: new Date(booking.date).setUTCHours(0, 0, 0, 0),
        scope: booking.availabilityScope,
      });

      if (availability) {
        await availability.removeBooking(booking._id);
      }
    }

    // invalidate Redis cache
    await cacheDeletePattern(`${CACHE_KEYS.availability("")}*`);
  } catch (err) {
    console.error("⚠️  Availability update on cancel failed:", err.message);
  }

  // 9. send cancellation email (fire-and-forget)
  sendCancellationAndRefund(booking.user, booking, refundAmount);

  // 10. emit WebSocket event
  if (io) {
    emitBookingCancelled(io, booking._id, booking.user._id, refundInitiated);
  }

  // 11. in-app notifications — fire-and-forget, never block the response
  notifyAdmins(
    io,
    "booking_cancelled",
    "Booking Cancelled",
    `${booking.user.name} cancelled ${booking.bookingRef}${refundInitiated ? ` — refund of ₹${refundAmount} initiated` : ""}`,
    { bookingId: booking._id, bookingRef: booking.bookingRef },
  );
  notifyUser(
    io,
    booking.user._id,
    "booking_cancelled",
    "Booking Cancelled",
    `Your booking ${booking.bookingRef} has been cancelled${refundInitiated ? `. A refund of ₹${refundAmount} is on its way.` : "."}`,
    { bookingId: booking._id, bookingRef: booking.bookingRef },
  );

  return { booking, refundAmount, refundInitiated };
};

module.exports = {
  createPaymentOrder,
  verifyAndConfirmPayment,
  processCancellationRefund,
};
