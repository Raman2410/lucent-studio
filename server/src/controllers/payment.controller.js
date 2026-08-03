"use strict";

const { AppError } = require("../middlewares/error.middleware");
const { sendSuccess, STATUS } = require("../utils/apiResponse");
const {
  createPaymentOrder,
  verifyAndConfirmPayment,
  processCancellationRefund,
} = require("../services/razorpay.service");
const { fetchPayment } = require("../config/razorpay");
const Booking = require("../models/Booking.model");

// ─────────────────────────────────────────
// CREATE PAYMENT ORDER
// POST /api/payment/order
// protected — step 1 of payment flow
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/payment/order:
 *   post:
 *     summary: Create a Razorpay payment order for a booking
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId]
 *             properties:
 *               bookingId:
 *                 type: string
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Razorpay order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orderId:
 *                   type: string
 *                   example: "order_PqR3sT4uV5wX6y"
 *                 amount:
 *                   type: number
 *                   example: 2500000
 *                   description: Amount in paise
 *                 amountINR:
 *                   type: number
 *                   example: 25000
 *                 currency:
 *                   type: string
 *                   example: "INR"
 *                 bookingRef:
 *                   type: string
 *                   example: "BK-A3F2B1C4"
 *                 key:
 *                   type: string
 *                   description: Razorpay key_id for frontend checkout
 *       400:
 *         description: Invalid booking or already paid
 *       404:
 *         description: Booking not found
 */
const createOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    // verify booking belongs to requesting user
    const booking = await Booking.findById(bookingId).select("user status");
    if (!booking) {
      return next(new AppError("Booking not found", STATUS.NOT_FOUND));
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return next(
        new AppError(
          "You are not authorized to pay for this booking",
          STATUS.FORBIDDEN,
        ),
      );
    }

    // delegate to service
    const orderData = await createPaymentOrder(bookingId);

    console.log(
      `✅ Payment order created → ${orderData.orderId} | Booking: ${orderData.bookingRef}`,
    );

    // include Razorpay key_id for frontend checkout initialization
    return sendSuccess(res, STATUS.OK, "Payment order created", {
      ...orderData,
      key: process.env.RAZORPAY_KEY_ID, // frontend needs this for Razorpay.js
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// VERIFY PAYMENT
// POST /api/payment/verify
// protected — step 2 of payment flow
// called after Razorpay checkout success
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/payment/verify:
 *   post:
 *     summary: Verify Razorpay payment and confirm booking
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId]
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *                 example: "order_PqR3sT4uV5wX6y"
 *               razorpay_payment_id:
 *                 type: string
 *                 example: "pay_AbCdEfGhIjKl"
 *               razorpay_signature:
 *                 type: string
 *                 example: "abc123def456..."
 *               bookingId:
 *                 type: string
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Payment verified and booking confirmed
 *       400:
 *         description: Invalid payment signature
 */
const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
    } = req.body;

    const io = req.app.get("io");

    // verify booking belongs to requesting user — same check createOrder
    // and getPaymentStatus already do. Without this, a valid signature
    // for the requester's OWN payment could be replayed against someone
    // else's bookingId (see order-id cross-check inside the service call
    // below for the other half of this fix).
    const ownerCheck = await Booking.findById(bookingId).select("user");
    if (!ownerCheck) {
      return next(new AppError("Booking not found", STATUS.NOT_FOUND));
    }
    if (ownerCheck.user.toString() !== req.user._id.toString()) {
      return next(
        new AppError(
          "You are not authorized to confirm this booking",
          STATUS.FORBIDDEN,
        ),
      );
    }

    // delegate to service — handles full confirmation flow
    const booking = await verifyAndConfirmPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
      io,
    );

    console.log(
      `✅ Payment verified → ${razorpay_payment_id} | Booking: ${booking.bookingRef}`,
    );

    return sendSuccess(res, STATUS.OK, "Payment verified. Booking confirmed!", {
      bookingId: booking._id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      paymentId: razorpay_payment_id,
      amount: booking.amount.total,
      date: booking.date,
      endDate: booking.endDate,
      isMultiDay: booking.isMultiDay,
      time: booking.time,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET PAYMENT STATUS
// GET /api/payment/status/:bookingId
// protected — check payment status for a booking
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/payment/status/{bookingId}:
 *   get:
 *     summary: Get payment status for a booking
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment status fetched
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 */
const getPaymentStatus = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).select(
      "user status payment refund amount bookingRef date",
    );

    if (!booking) {
      return next(new AppError("Booking not found", STATUS.NOT_FOUND));
    }

    // ownership check
    if (booking.user.toString() !== req.user._id.toString()) {
      return next(
        new AppError(
          "You are not authorized to view this payment",
          STATUS.FORBIDDEN,
        ),
      );
    }

    // optionally fetch live payment details from Razorpay
    let razorpayDetails = null;
    if (booking.payment?.razorpayPaymentId) {
      try {
        razorpayDetails = await fetchPayment(booking.payment.razorpayPaymentId);
      } catch {
        // non-critical — continue without live details
      }
    }

    return sendSuccess(res, STATUS.OK, "Payment status fetched", {
      bookingId: booking._id,
      bookingRef: booking.bookingRef,
      bookingStatus: booking.status,
      amount: booking.amount,
      payment: {
        orderId: booking.payment?.razorpayOrderId,
        paymentId: booking.payment?.razorpayPaymentId,
        paidAt: booking.payment?.paidAt,
        method: booking.payment?.method,
        status: razorpayDetails?.status || null,
      },
      refund: booking.refund,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// RAZORPAY WEBHOOK
// POST /api/payment/webhook
// public — called by Razorpay servers
// handles async payment events
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/payment/webhook:
 *   post:
 *     summary: Razorpay webhook handler
 *     tags: [Payment]
 *     description: Called by Razorpay for async payment events. Do not call manually.
 *     responses:
 *       200:
 *         description: Webhook processed
 */
const handleWebhook = async (req, res, next) => {
  try {
    const crypto = require("crypto");

    // verify webhook signature — REQUIRED, never optional.
    // Previously this check was skipped whenever webhookSecret or
    // receivedSignature was missing, which meant an unconfigured
    // RAZORPAY_WEBHOOK_SECRET (as shipped in every .env file) made this
    // endpoint accept fully unauthenticated events. Fail closed instead.
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const receivedSignature = req.headers["x-razorpay-signature"];

    if (!webhookSecret) {
      // should be unreachable in practice — server.js refuses to boot
      // without RAZORPAY_WEBHOOK_SECRET — but guard anyway
      console.error("❌ RAZORPAY_WEBHOOK_SECRET is not configured — rejecting webhook");
      return res
        .status(500)
        .json({ success: false, message: "Webhook not configured" });
    }

    if (!receivedSignature) {
      console.warn("⚠️  Razorpay webhook request missing signature header");
      return res
        .status(400)
        .json({ success: false, message: "Missing signature" });
    }

    // req.body is the RAW request buffer here (see app.js — this route is
    // mounted with express.raw() ahead of the global express.json()
    // parser). Signing the raw bytes is required: JSON.stringify(req.body)
    // on an already-parsed object can serialize keys in a different order
    // / spacing than what Razorpay actually sent and signed, which made
    // signature verification unreliable.
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== receivedSignature) {
      console.warn("⚠️  Invalid Razorpay webhook signature");
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    // now that the signature is verified, parse the raw buffer as JSON
    const parsedBody = Buffer.isBuffer(req.body)
      ? JSON.parse(rawBody.toString("utf8"))
      : req.body;

    const { event, payload } = parsedBody;

    console.log(`📨 Razorpay webhook received: ${event}`);

    switch (event) {
      case "payment.captured": {
        // payment captured — this is backup for verify endpoint
        // verify endpoint handles the primary flow
        const paymentId = payload?.payment?.entity?.id;
        const orderId = payload?.payment?.entity?.order_id;

        console.log(
          `💳 Webhook: payment.captured → paymentId: ${paymentId} | orderId: ${orderId}`,
        );
        break;
      }

      case "refund.processed": {
        // update refund status to "processed"
        const refundId = payload?.refund?.entity?.id;
        const paymentId = payload?.refund?.entity?.payment_id;

        await Booking.findOneAndUpdate(
          { "payment.razorpayPaymentId": paymentId },
          {
            "refund.status": "processed",
            "refund.razorpayRefundId": refundId,
          },
        );

        console.log(`✅ Webhook: refund.processed → ${refundId}`);
        break;
      }

      case "refund.failed": {
        const paymentId = payload?.refund?.entity?.payment_id;

        await Booking.findOneAndUpdate(
          { "payment.razorpayPaymentId": paymentId },
          { "refund.status": "failed" },
        );

        console.log(`❌ Webhook: refund.failed for payment: ${paymentId}`);
        break;
      }

      default:
        console.log(`ℹ️  Unhandled webhook event: ${event}`);
    }

    // always respond 200 to Razorpay — otherwise they retry
    return res.status(200).json({ success: true, message: "Webhook received" });
  } catch (error) {
    console.error("❌ Webhook error:", error.message);
    // still return 200 — prevents Razorpay from retrying on our server errors
    return res.status(200).json({ success: true, message: "Webhook received" });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getPaymentStatus,
  handleWebhook,
};
