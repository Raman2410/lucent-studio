"use strict";

const express = require("express");
const router = express.Router();

const {
  createOrder,
  verifyPayment,
  getPaymentStatus,
} = require("../controllers/payment.controller");

const { protect } = require("../middlewares/auth.middleware");

const {
  validate,
  paymentSchemas,
} = require("../middlewares/validate.middleware");

// ─────────────────────────────────────────
// PAYMENT ROUTES
// ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Payment
 *   description: Razorpay payment integration
 */

// POST /api/payment/order — create Razorpay order
router.post(
  "/order",
  protect,
  validate(paymentSchemas.createOrder),
  createOrder,
);

// POST /api/payment/verify — verify + confirm booking
router.post(
  "/verify",
  protect,
  validate(paymentSchemas.verifyPayment),
  verifyPayment,
);

// GET /api/payment/status/:bookingId
router.get("/status/:bookingId", protect, getPaymentStatus);

// NOTE: POST /api/payment/webhook is intentionally NOT defined here.
// It's mounted directly in app.js, ahead of the global express.json()
// parser, with express.raw() instead — the webhook signature check needs
// the raw request bytes, not the parsed body this router receives.

module.exports = router;
