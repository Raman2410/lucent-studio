import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CalendarDays, Clock, MapPin, Loader2, AlertCircle,
  ArrowLeft, XCircle, CreditCard, History, CheckCircle2, Star,
} from "lucide-react";
// Loader2 already imported above — used both for the page loading
// spinner and the cancel-button's in-flight state.
import { Button } from "@/components/ui/button";
import BookingTimeline from "@/components/booking/BookingTimeline";
import ReviewForm from "@/components/booking/ReviewForm";
import bookingService from "@/services/bookingService";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const STATUS_META = {
  "Pending":      { color: "text-amber-600", bg: "bg-amber-50",      border: "border-amber-200", label: "Pending payment" },
  "Payment Done": { color: "text-blue-600",  bg: "bg-blue-50",       border: "border-blue-200",  label: "Payment received" },
  "Confirmed":    { color: "text-signature", bg: "bg-signature-tint",border: "border-signature/20",label: "Confirmed" },
  "In Progress":  { color: "text-purple-600",bg: "bg-purple-50",     border: "border-purple-200",label: "In progress" },
  "Completed":    { color: "text-ink",       bg: "bg-paper-dim",     border: "border-line",      label: "Completed" },
  "Cancelled":    { color: "text-red-500",   bg: "bg-red-50",        border: "border-red-200",   label: "Cancelled" },
};

const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);

const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }) : "—";

/**
 * BookingDetail — single-booking view at GET /api/bookings/:id.
 *
 * bookingService.getById already existed for this, but there was no
 * page wired up to it — bookings could only be seen inside the
 * My Bookings list. This gives each booking its own shareable,
 * refreshable URL with the full record: amount breakdown, payment
 * and refund details, status history, and reschedule/cancellation
 * info, none of which fit in the list row.
 */
export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    bookingService
      .getById(id)
      .then((res) => { if (!cancelled) setBooking(res.data); })
      .catch((err) => { if (!cancelled) setError(err.message || "Couldn't load this booking."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    setCancelling(true);
    try {
      const res = await bookingService.cancel(id, "Cancelled by user");
      // the cancel endpoint returns a small summary object (status,
      // refund info), NOT the full booking — merge just those fields
      // in rather than replacing `booking` wholesale, which was
      // wiping out the package/date/time/amount fields on screen.
      setBooking((prev) => ({
        ...prev,
        status: res.data.status,
        refund: {
          ...prev.refund,
          amount: res.data.refundAmount,
          status: res.data.refundInitiated ? "initiated" : "none",
        },
      }));
    } catch (err) {
      alert(err.message || "Couldn't cancel. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-mist-light">
        <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.5} />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container-page py-24 text-center">
        <AlertCircle className="h-6 w-6 text-mist mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-display text-xl text-ink mb-2">Couldn't load this booking</p>
        <p className="text-sm text-mist mb-6">{error}</p>
        <Button variant="outline" asChild>
          <Link to="/my-bookings">Back to My Bookings</Link>
        </Button>
      </div>
    );
  }

  const meta = STATUS_META[booking.status] ?? STATUS_META["Pending"];
  const isOwner = user && booking.user?._id === user._id;
  const canCancel = isOwner && ["Pending", "Payment Done", "Confirmed"].includes(booking.status);
  const itemName = booking.type === "rental"
    ? [booking.camera?.brand, booking.camera?.model].filter(Boolean).join(" ") || booking.cameraSnapshot?.name
    : booking.package?.name || booking.packageSnapshot?.name;
  const includedItems = booking.type === "rental"
    ? (booking.camera?.accessories ?? []).map((a) => a.name)
    : booking.package?.includes ?? [];

  return (
    <div className="container-page py-16 sm:py-20">
      <div className="max-w-2xl mx-auto">
        <Link
          to="/my-bookings"
          className="inline-flex items-center gap-1.5 text-[13px] text-mist hover:text-signature transition-colors mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          My bookings
        </Link>

        {/* header */}
        <div className="mb-8 pb-8 border-b border-line">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <p className="meta-caption">{booking.bookingRef}</p>
            <span className={cn("px-2 py-0.5 text-[11.5px] font-mono border", meta.bg, meta.border, meta.color)}>
              {meta.label}
            </span>
          </div>
          <h1 className="font-display text-3xl text-ink mb-2">{itemName || "Booking"}</h1>
          <p className="text-mist text-sm">
            {booking.type === "photography" ? "Photography session" : "Camera rental"}
          </p>
        </div>

        {/* session details */}
        <div className="mb-8 pb-8 border-b border-line">
          <p className="meta-caption mb-4">Session details</p>
          <div className="space-y-3 text-[14px]">
            <div className="flex items-center gap-2.5 text-ink">
              <CalendarDays className="h-4 w-4 text-mist shrink-0" strokeWidth={1.5} />
              {new Date(booking.date).toLocaleDateString("en-US", { dateStyle: "long" })}
            </div>
            <div className="flex items-center gap-2.5 text-ink">
              <Clock className="h-4 w-4 text-mist shrink-0" strokeWidth={1.5} />
              {booking.time}
            </div>
            {booking.location && (
              <div className="flex items-center gap-2.5 text-ink">
                <MapPin className="h-4 w-4 text-mist shrink-0" strokeWidth={1.5} />
                {booking.location}
              </div>
            )}
          </div>

          {booking.type === "rental" && (
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[13.5px]">
              {booking.rentalType && <Detail label="Rental type" value={booking.rentalType} />}
              {booking.selectedAccessories?.length > 0 && (
                <Detail label="Accessories" value={booking.selectedAccessories.join(", ")} />
              )}
              {booking.withPhotographer && <Detail label="Add-on" value="With photographer" />}
            </div>
          )}

          {booking.notes && (
            <div className="mt-5">
              <Detail label="Notes" value={booking.notes} />
            </div>
          )}
        </div>

        {/* everything included in this package / rental kit */}
        {includedItems.length > 0 && (
          <div className="mb-8 pb-8 border-b border-line">
            <p className="meta-caption mb-4">
              {booking.type === "rental" ? "Kit includes" : "What's included"}
            </p>
            <ul className="space-y-2">
              {includedItems.map((inc, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-[14px] text-ink-soft">
                  <CheckCircle2 className="h-4 w-4 text-signature shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>{inc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* amount breakdown */}
        <div className="mb-8 pb-8 border-b border-line">
          <p className="meta-caption mb-4">Amount</p>
          <div className="space-y-2 text-[14px]">
            <Row label="Subtotal" value={formatINR(booking.amount?.subtotal)} />
            {booking.amount?.accessoryCost > 0 && <Row label="Accessories" value={formatINR(booking.amount.accessoryCost)} />}
            {booking.amount?.photographerCost > 0 && <Row label="Photographer add-on" value={formatINR(booking.amount.photographerCost)} />}
            {booking.amount?.securityDeposit > 0 && <Row label="Security deposit" value={formatINR(booking.amount.securityDeposit)} />}
            <div className="flex justify-between items-baseline pt-2 border-t border-line">
              <span className="text-ink font-medium">Total</span>
              <span className="font-display text-xl text-ink">{formatINR(booking.amount?.total)}</span>
            </div>
          </div>
        </div>

        {/* payment info */}
        {(booking.payment?.razorpayPaymentId || booking.payment?.paidAt) && (
          <div className="mb-8 pb-8 border-b border-line">
            <p className="meta-caption mb-4 flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5" strokeWidth={1.5} />
              Payment
            </p>
            <div className="space-y-2 text-[14px]">
              {booking.payment.method && <Row label="Method" value={booking.payment.method} />}
              {booking.payment.paidAt && <Row label="Paid on" value={formatDateTime(booking.payment.paidAt)} />}
              {booking.payment.razorpayPaymentId && (
                <Row label="Payment ID" value={booking.payment.razorpayPaymentId} mono />
              )}
            </div>
          </div>
        )}

        {/* cancellation info */}
        {booking.status === "Cancelled" && booking.cancellation?.cancelledAt && (
          <div className="mb-8 pb-8 border-b border-line">
            <p className="meta-caption mb-4">Cancellation</p>
            <div className="space-y-2 text-[14px]">
              <Row label="Cancelled on" value={formatDateTime(booking.cancellation.cancelledAt)} />
              {booking.cancellation.reason && <Row label="Reason" value={booking.cancellation.reason} />}
            </div>
          </div>
        )}

        {/* status history — visual timeline */}
        {booking.statusHistory?.length > 0 && (
          <div className="mb-10">
            <p className="meta-caption mb-5 flex items-center gap-2">
              <History className="h-3.5 w-3.5" strokeWidth={1.5} />
              History
            </p>
            <BookingTimeline history={booking.statusHistory} />
          </div>
        )}

        {/* review — completed bookings the user hasn't reviewed yet */}
        {isOwner && booking.status === "Completed" && !booking.hasReview && (
          <div className="mb-10 pb-10 border-b border-line">
            <p className="meta-caption mb-4 flex items-center gap-2">
              <Star className="h-3.5 w-3.5" strokeWidth={1.5} />
              Leave a review
            </p>
            <ReviewForm
              bookingId={booking._id}
              itemName={itemName}
              onSubmitted={() => setBooking((prev) => ({ ...prev, hasReview: true }))}
            />
          </div>
        )}

        {isOwner && booking.status === "Completed" && booking.hasReview && (
          <div className="mb-10 flex items-center gap-2.5 text-[13.5px] text-mist">
            <CheckCircle2 className="h-4 w-4 text-signature shrink-0" strokeWidth={1.5} />
            You've already reviewed this booking — thanks for the feedback!
          </div>
        )}

        {/* actions */}
        <div className="flex items-center gap-3">
          {isOwner && booking.status === "Pending" && (
            <Button variant="signature" size="lg" asChild>
              <Link to={`/pay/${booking._id}`}>Complete payment</Link>
            </Button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-1.5 px-4 h-11 rounded-[2px] border border-red-200 text-[13px] font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {cancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <XCircle className="h-4 w-4" strokeWidth={1.5} />
              )}
              {cancelling ? "Cancelling…" : "Cancel booking"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="meta-caption mb-0.5">{label}</p>
      <p className="text-ink text-[14px]">{value}</p>
    </div>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-mist">{label}</span>
      <span className={cn("text-ink", mono && "font-mono text-[12.5px]")}>{value}</span>
    </div>
  );
}
