import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import BookingPaymentPanel from "@/components/booking/BookingPaymentPanel";
import bookingService from "@/services/bookingService";

const STATUS_LABEL = {
  "Payment Done": "already been paid for",
  "Confirmed": "already confirmed",
  "In Progress": "already in progress",
  "Completed": "already completed",
  "Cancelled": "cancelled",
};

/**
 * Pay — standalone "complete payment" page for an existing booking.
 *
 * Unlike Booking.jsx's post-submit confirmation screen (which only
 * exists in-memory for the session that just created the booking),
 * this page loads everything it needs from GET /api/bookings/:id
 * using only the id in the URL. That means "Complete payment" from
 * My Bookings keeps working even if the user closed the tab, came
 * back days later, refreshed the page, or opened the link fresh —
 * no reliance on router state that a new page load would lose.
 */
export default function Pay() {
  const { bookingId } = useParams();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    bookingService
      .getById(bookingId)
      .then((res) => { if (!cancelled) setBooking(res.data); })
      .catch((err) => { if (!cancelled) setError(err.message || "Couldn't load this booking."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [bookingId]);

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
        <p className="font-display text-xl text-ink mb-2">Couldn't load this booking</p>
        <p className="text-sm text-mist mb-6">{error}</p>
        <Button variant="outline" asChild>
          <Link to="/my-bookings">Back to My Bookings</Link>
        </Button>
      </div>
    );
  }

  // this booking is no longer awaiting its first payment — nothing
  // to pay here (either already paid, or cancelled)
  if (booking.status !== "Pending") {
    return (
      <div className="container-page py-24 max-w-lg mx-auto text-center">
        <p className="meta-caption mb-2">{booking.bookingRef}</p>
        <h1 className="font-display text-2xl text-ink mb-4">
          This booking has {STATUS_LABEL[booking.status] || "already moved on"}
        </h1>
        <p className="text-sm text-mist mb-8">There's nothing pending payment on this booking anymore.</p>
        <Button variant="signature" asChild>
          <Link to="/my-bookings">View my bookings</Link>
        </Button>
      </div>
    );
  }

  const itemName =
    booking.type === "rental"
      ? [booking.camera?.brand, booking.camera?.model].filter(Boolean).join(" ") || booking.cameraSnapshot?.name
      : booking.package?.name || booking.packageSnapshot?.name;

  const includedItems =
    booking.type === "rental"
      ? (booking.camera?.accessories ?? []).map((a) => a.name)
      : booking.package?.includes ?? [];

  return (
    <BookingPaymentPanel
      booking={{
        bookingId: booking._id,
        bookingRef: booking.bookingRef,
        status: booking.status,
        amount: booking.amount,
        date: booking.date,
        endDate: booking.endDate,
        isMultiDay: booking.isMultiDay,
        time: booking.time,
        type: booking.type,
        itemName,
        includedItems,
        rentalType: booking.rentalType,
        selectedAccessories: booking.selectedAccessories,
        withPhotographer: booking.withPhotographer,
      }}
    />
  );
}
