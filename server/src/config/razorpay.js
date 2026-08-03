"use strict";

const Razorpay = require("razorpay");
const crypto = require("crypto");

// ─────────────────────────────────────────
// RAZORPAY INSTANCE
// ─────────────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────
// CURRENCY & AMOUNT HELPERS
// Razorpay works in smallest currency unit
// INR → paise (1 INR = 100 paise)
// ─────────────────────────────────────────

/**
 * Convert INR to paise for Razorpay
 * @param {number} amountInINR
 * @returns {number} amount in paise
 */
const toPaise = (amountInINR) => Math.round(amountInINR * 100);

/**
 * Convert paise back to INR for display
 * @param {number} amountInPaise
 * @returns {number} amount in INR
 */
const toINR = (amountInPaise) => amountInPaise / 100;

// ─────────────────────────────────────────
// CREATE ORDER
// ─────────────────────────────────────────

/**
 * Create a Razorpay order
 * Called before showing payment UI to user
 * @param {number} amountInINR — booking amount in INR
 * @param {string} bookingId   — our internal booking ID (stored as receipt)
 * @param {object} notes       — optional metadata (shown in Razorpay dashboard)
 * @returns {object} Razorpay order object { id, amount, currency, receipt }
 */
const createOrder = async (amountInINR, bookingId, notes = {}) => {
  try {
    const order = await razorpay.orders.create({
      amount: toPaise(amountInINR), // must be in paise
      currency: "INR",
      receipt: `booking_${bookingId}`, // max 40 chars — visible in dashboard
      notes: {
        bookingId: bookingId.toString(),
        ...notes,
      },
    });

    console.log(`✅ Razorpay order created → ${order.id} (₹${amountInINR})`);
    return order;
  } catch (error) {
    console.error("❌ Razorpay order creation failed:", error.message);
    throw new Error(`Payment order creation failed: ${error.message}`);
  }
};

// ─────────────────────────────────────────
// VERIFY PAYMENT SIGNATURE
// critical security step — must always verify
// before marking booking as paid
// ─────────────────────────────────────────

/**
 * Verify Razorpay payment signature
 * Razorpay signs the payment with HMAC-SHA256
 * We re-compute and compare — if mismatch, payment is tampered
 *
 * @param {string} razorpay_order_id   — from Razorpay checkout
 * @param {string} razorpay_payment_id — from Razorpay checkout
 * @param {string} razorpay_signature  — from Razorpay checkout
 * @returns {boolean} true if valid, false if tampered
 */
const verifyPaymentSignature = (
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
) => {
  try {
    // Razorpay signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret)
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      console.warn(
        "⚠️  Razorpay signature mismatch — possible payment tampering",
      );
    }

    return isValid;
  } catch (error) {
    console.error("❌ Signature verification error:", error.message);
    return false;
  }
};

// ─────────────────────────────────────────
// INITIATE REFUND
// ─────────────────────────────────────────

/**
 * Initiate a full or partial refund via Razorpay
 * @param {string} paymentId    — razorpay_payment_id from verified payment
 * @param {number} amountInINR  — refund amount in INR (full or partial)
 * @param {object} notes        — optional metadata
 * @returns {object} Razorpay refund object
 */
const initiateRefund = async (paymentId, amountInINR, notes = {}) => {
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: toPaise(amountInINR), // in paise
      speed: "normal", // "normal" (5-7 days) or "optimum" (instant, extra fee)
      notes: {
        reason: "Cancellation refund — 48hrs policy",
        ...notes,
      },
    });

    console.log(
      `✅ Razorpay refund initiated → ${refund.id} (₹${amountInINR}) for payment ${paymentId}`,
    );

    return refund;
  } catch (error) {
    console.error("❌ Razorpay refund failed:", error.message);
    throw new Error(`Refund initiation failed: ${error.message}`);
  }
};

// ─────────────────────────────────────────
// FETCH PAYMENT DETAILS
// useful for admin verification or dispute resolution
// ─────────────────────────────────────────

/**
 * Fetch payment details from Razorpay by payment ID
 * @param {string} paymentId
 * @returns {object} Razorpay payment object
 */
const fetchPayment = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error("❌ Razorpay fetch payment failed:", error.message);
    throw new Error(`Failed to fetch payment: ${error.message}`);
  }
};

// ─────────────────────────────────────────
// CANCELLATION REFUND ELIGIBILITY CHECK
// business rule: full refund if cancelled 48hrs before shoot
// ─────────────────────────────────────────

/**
 * Check if booking is eligible for full refund
 * @param {Date} shootDate — the scheduled shoot date
 * @returns {{ eligible: boolean, hoursLeft: number }}
 */
const checkRefundEligibility = (shootDate) => {
  const now = new Date();
  const shoot = new Date(shootDate);
  const diffMs = shoot - now;
  const hoursLeft = diffMs / (1000 * 60 * 60);

  return {
    eligible: hoursLeft >= 48,
    hoursLeft: Math.round(hoursLeft),
  };
};

module.exports = {
  razorpay,
  toPaise,
  toINR,
  createOrder,
  verifyPaymentSignature,
  initiateRefund,
  fetchPayment,
  checkRefundEligibility,
};
