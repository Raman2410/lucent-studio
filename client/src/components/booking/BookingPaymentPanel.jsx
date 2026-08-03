import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import paymentService, { loadRazorpayCheckout } from "@/services/paymentService";
import { useAuth } from "@/context/AuthContext";

const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);

// booking.date/time OR booking.date/endDate (multi-day, no time slot)
function formatWhen(booking) {
  const start = new Date(booking.date).toLocaleDateString("en-US", { dateStyle: "long" });
  if (booking.isMultiDay && booking.endDate) {
    const end = new Date(booking.endDate).toLocaleDateString("en-US", { dateStyle: "long" });
    return `${start} – ${end}`;
  }
  return `${start} at ${booking.time}`;
}

// shows every item included in the booked package/rental — kept in one
// place so the "paid" and "pending payment" screens below stay in sync
function IncludedItemsSummary({ booking }) {
  if (!booking.itemName && !booking.includedItems?.length) return null;

  return (
    <div className="border border-line p-6 mb-6 text-left">
      {booking.itemName && (
        <p className="font-display text-lg text-ink mb-3">{booking.itemName}</p>
      )}

      {booking.includedItems?.length > 0 && (
        <div className="mb-1">
          <p className="text-[11px] font-mono uppercase tracking-wider text-mist mb-2">
            {booking.type === "rental" ? "Kit includes" : "What's included"}
          </p>
          <ul className="space-y-1.5">
            {booking.includedItems.map((inc, idx) => (
              <li key={idx} className="flex items-start gap-2 text-[13.5px] text-ink-soft">
                <CheckCircle2 className="h-3.5 w-3.5 text-signature shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>{inc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {booking.type === "rental" && (booking.rentalType || booking.selectedAccessories?.length > 0 || booking.withPhotographer) && (
        <div className="mt-4 pt-4 border-t border-line space-y-1.5 text-[13px] text-mist">
          {booking.rentalType && <p>Rental: <span className="text-ink capitalize">{booking.rentalType}</span></p>}
          {booking.selectedAccessories?.length > 0 && (
            <p>Selected add-ons: <span className="text-ink">{booking.selectedAccessories.join(", ")}</span></p>
          )}
          {booking.withPhotographer && <p className="text-ink">+ Photographer add-on</p>}
        </div>
      )}
    </div>
  );
}

/**
 * BookingPaymentPanel — the real Razorpay flow, matching
 * payment.controller.js exactly:
 *   1. POST /api/payment/order  -> Razorpay order + key_id
 *   2. open Razorpay's hosted checkout modal
 *   3. on success -> POST /api/payment/verify (signature check +
 *      booking confirmation happens server-side)
 *
 * Extracted so it can be shown both right after creating a new
 * booking (Booking.jsx) and when resuming payment on an existing
 * Pending booking from a fresh page load (Pay.jsx) — neither case
 * needs anything beyond the booking's own data plus its id.
 *
 * @param {object} booking - { bookingId, bookingRef, status, amount, date, time, type,
 *   itemName?, includedItems?, rentalType?, selectedAccessories?, withPhotographer? }
 *   The optional fields let this panel show exactly what's included in the
 *   package/rental — passed by Booking.jsx (fresh booking) or Pay.jsx (resumed
 *   booking, loaded from the populated package/camera on the backend).
 */
export default function BookingPaymentPanel({ booking }) {
  const { user } = useAuth();
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paid, setPaid] = useState(null); // verify-response on success

  const handlePayment = async () => {
    if (paying) return;
    setPaying(true);
    setPaymentError("");

    try {
      await loadRazorpayCheckout();

      const order = await paymentService.createOrder(booking.bookingId);

      const rzp = new window.Razorpay({
        key: order.data.key,
        amount: order.data.amount, // paise, straight from the backend — never recomputed client-side
        currency: order.data.currency,
        order_id: order.data.orderId,
        name: "Lucent Studio",
        description: `Booking — ${order.data.bookingRef}`,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        theme: { color: "#2e3e33" }, // --color-signature, keeps the modal on-brand
        handler: async (response) => {
          try {
            const verifyRes = await paymentService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId: booking.bookingId,
            });
            setPaid(verifyRes.data);
          } catch (err) {
            setPaymentError(
              err.message || "Payment succeeded but confirmation failed — contact us with your payment ID."
            );
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false), // user closed the modal without paying
        },
      });

      rzp.on("payment.failed", (resp) => {
        setPaymentError(resp.error?.description || "Payment failed. Please try again.");
        setPaying(false);
      });

      rzp.open();
    } catch (err) {
      setPaymentError(err.message || "Couldn't start the payment. Please try again.");
      setPaying(false);
    }
  };

  // ── paid / confirmed screen — shown once verifyPayment succeeds ──
  if (paid) {
    return (
      <div className="container-page py-24 max-w-lg mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <CheckCircle2 className="h-10 w-10 text-signature mx-auto mb-6" strokeWidth={1.5} />
          <p className="meta-caption mb-2">{paid.bookingRef}</p>
          <h1 className="font-display text-3xl text-ink mb-4">Booking confirmed</h1>
          <p className="text-mist text-[15px] leading-relaxed mb-8">
            Payment received — you're all set for{" "}
            {formatWhen(paid)}.
            {" "}A confirmation email is on its way.
          </p>

          <IncludedItemsSummary booking={booking} />

          <div className="border border-line p-6 mb-8 text-left space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-mist">Status</span>
              <span className="text-ink font-medium">{paid.status}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-mist">Amount paid</span>
              <span className="font-display text-2xl text-ink">{formatINR(paid.amount)}</span>
            </div>
          </div>

          <Button variant="signature" size="lg" asChild>
            <Link to="/my-bookings">View my bookings</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── pending confirmation — booking exists, payment still needed ──
  return (
    <div className="container-page py-24 max-w-lg mx-auto text-center">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <CheckCircle2 className="h-10 w-10 text-signature mx-auto mb-6" strokeWidth={1.5} />
        <p className="meta-caption mb-2">{booking.bookingRef}</p>
        <h1 className="font-display text-3xl text-ink mb-4">Booking received</h1>
        <p className="text-mist text-[15px] leading-relaxed mb-8">
          Your booking is <strong className="text-ink">{booking.status}</strong> — reserved for{" "}
          {formatWhen(booking)}.
          {" "}Complete payment to confirm your slot.
        </p>

        <IncludedItemsSummary booking={booking} />

        <div className="border border-line p-6 mb-8 text-left">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-mist">Amount due</span>
            <span className="font-display text-2xl text-ink">{formatINR(booking.amount?.total)}</span>
          </div>
        </div>

        {paymentError && (
          <p className="flex items-center gap-2 text-[13px] font-mono text-red-500/90 mb-4 text-left">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {paymentError}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Button variant="signature" size="lg" onClick={handlePayment} disabled={paying}>
            {paying ? "Opening secure checkout…" : `Pay ${formatINR(booking.amount?.total)} now`}
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/my-bookings">Pay later from My Bookings</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
