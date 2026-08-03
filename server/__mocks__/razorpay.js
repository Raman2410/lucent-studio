"use strict";

/**
 * MANUAL JEST MOCK for the `razorpay` npm package.
 *
 * Place this file at:  server/__mocks__/razorpay.js
 * (Jest auto-discovers manual mocks for node_modules packages when the
 * folder is named __mocks__ and sits at the project root — same level
 * as node_modules/package.json — NOT inside src/.)
 *
 * Then in tests/setup.js, add near the top:
 *   jest.mock("razorpay");
 *
 * WHY THIS EXISTS
 * config/razorpay.js does `new Razorpay({ key_id, key_secret })` and then
 * calls `.orders.create()`, `.payments.fetch()`, `.payments.refund()` —
 * all of which are real network calls to Razorpay's servers. That's what
 * caused the flaky/undefined-error test failures you were seeing. This
 * mock intercepts the SDK itself, so your own code in config/razorpay.js
 * (toPaise, toINR, verifyPaymentSignature, checkRefundEligibility) still
 * runs for real and is still genuinely tested — only the third-party
 * network boundary is faked.
 *
 * The IDs/behavior below are deliberately realistic-shaped so your
 * controllers/services (which check things like `order.id`,
 * `payment.method`, `refund.id`) get back exactly what they expect from
 * the real SDK.
 */

let orderCounter = 0;
let refundCounter = 0;

// in-memory store so fetchPayment() can return a payment that matches
// whatever order/payment your test created earlier in the same test,
// if you want to extend this later for more elaborate scenarios
const paymentFixtures = new Map();

function randomId(prefix) {
  const rand = Math.random().toString(36).slice(2, 12);
  return `${prefix}_test_${rand}`;
}

class Razorpay {
  constructor(_options) {
    // real SDK stores key_id/key_secret here — not needed for the mock,
    // but kept as a no-op constructor so `new Razorpay({...})` never throws
    this.orders = {
      create: jest.fn(async ({ amount, currency = "INR", receipt, notes }) => {
        orderCounter += 1;
        const order = {
          id: randomId("order"),
          entity: "order",
          amount,
          amount_paid: 0,
          amount_due: amount,
          currency,
          receipt,
          status: "created",
          attempts: 0,
          notes: notes || {},
          created_at: Math.floor(Date.now() / 1000),
        };
        return order;
      }),
    };

    this.payments = {
      fetch: jest.fn(async (paymentId) => {
        // return a plausible "captured" payment by default
        return (
          paymentFixtures.get(paymentId) || {
            id: paymentId,
            entity: "payment",
            amount: 2500000,
            currency: "INR",
            status: "captured",
            method: "card",
            captured: true,
            order_id: randomId("order"),
            created_at: Math.floor(Date.now() / 1000),
          }
        );
      }),

      refund: jest.fn(
        async (paymentId, { amount, speed = "normal", notes } = {}) => {
          refundCounter += 1;
          return {
            id: randomId("rfnd"),
            entity: "refund",
            amount,
            currency: "INR",
            payment_id: paymentId,
            status: "processed",
            speed_processed: speed,
            notes: notes || {},
            created_at: Math.floor(Date.now() / 1000),
          };
        },
      ),
    };
  }
}

// allow tests to seed a specific payment fixture if needed, e.g.:
//   const Razorpay = require("razorpay");
//   Razorpay.__setPaymentFixture("pay_abc123", { method: "upi", status: "captured" });
Razorpay.__setPaymentFixture = (paymentId, data) => {
  paymentFixtures.set(paymentId, { id: paymentId, entity: "payment", ...data });
};

Razorpay.__reset = () => {
  orderCounter = 0;
  refundCounter = 0;
  paymentFixtures.clear();
};

module.exports = Razorpay;
