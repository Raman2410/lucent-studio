import api from "@/lib/api";

/**
 * paymentService — matches server/src/routes/payment.routes.js
 *
 *   POST /api/payment/order              create Razorpay order
 *   POST /api/payment/verify             verify signature + confirm booking
 *   GET  /api/payment/status/:bookingId
 *
 * (POST /api/payment/webhook is server-to-server only — Razorpay
 * calls it directly, the frontend never touches it.)
 */
const paymentService = {
  createOrder: (bookingId) => api.post("/payment/order", { bookingId }),

  verifyPayment: ({ razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId }) =>
    api.post("/payment/verify", { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId }),

  getStatus: (bookingId) => api.get(`/payment/status/${bookingId}`),
};

export default paymentService;

/**
 * loadRazorpayCheckout — lazily injects Razorpay's checkout.js.
 * Loaded on-demand (only when a user actually reaches payment)
 * rather than on every page, and cached so repeat bookings in the
 * same session don't re-fetch it.
 */
let razorpayScriptPromise = null;

export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScriptPromise = null; // allow retry on next attempt
      reject(new Error("Couldn't load the payment gateway. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}
