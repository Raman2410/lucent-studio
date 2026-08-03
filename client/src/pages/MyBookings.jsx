import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  CalendarDays, Clock, MapPin, AlertCircle, CheckCircle2,
  XCircle, RotateCcw, Wifi, WifiOff, ChevronDown, ChevronUp, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AvailabilityCalendar from "@/components/booking/AvailabilityCalendar";
import bookingService from "@/services/bookingService";
import useBookingSocket from "@/hooks/useBookingSocket";
import socket from "@/services/socketService";
import { cn } from "@/lib/utils";

/**
 * MyBookings — authenticated page showing the user's bookings with
 * real-time status updates via Socket.io.
 *
 * Socket flow (matches socket.js exactly):
 *   1. AuthContext connected the socket when user logged in
 *   2. useBookingSocket registers booking:statusUpdated listener
 *      on the user's personal room (userId) — all their bookings
 *   3. On update: find the booking in local state by bookingId and
 *      patch just that item so the rest of the list doesn't flash
 *   4. A toast-style notification slides in for 4 seconds
 */

const STATUS_META = {
  "Pending":      { color: "text-amber-600", bg: "bg-amber-50",     border: "border-amber-200", label: "Pending payment" },
  "Payment Done": { color: "text-blue-600",  bg: "bg-blue-50",      border: "border-blue-200",  label: "Payment received" },
  "Confirmed":    { color: "text-signature", bg: "bg-signature-tint",border: "border-signature/20",label: "Confirmed" },
  "In Progress":  { color: "text-purple-600",bg: "bg-purple-50",    border: "border-purple-200",label: "In progress" },
  "Completed":    { color: "text-ink",       bg: "bg-paper-dim",    border: "border-line",      label: "Completed" },
  "Cancelled":    { color: "text-red-500",   bg: "bg-red-50",       border: "border-red-200",   label: "Cancelled" },
};

const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);

const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00",
];

// booking.date comes back from the API as a full ISO datetime string
// (e.g. "2026-08-15T00:00:00.000Z") since it's stored as a Mongoose
// Date — NOT as a plain "YYYY-MM-DD" string. Appending "T00:00:00" to
// that (like the calendar-picker pages do for their plain date
// strings) produces "...000ZT00:00:00", which is an invalid date.
// This parses either shape safely.
const formatBookingDate = (dateStr, opts = { dateStyle: "medium" }) => {
  if (!dateStr) return "—";
  const d = dateStr.includes("T") ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", opts);
};

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveToast, setLiveToast] = useState(null); // { message, status }
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [expandedId, setExpandedId] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // ── reschedule flow (inline in the expanded row) ──
  const [reschedulingId, setReschedulingId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(null);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleError, setRescheduleError] = useState("");

  // ── initial fetch ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bookingService
      .getMyBookings()
      .then((res) => { if (!cancelled) setBookings(res.data ?? []); })
      .catch((err) => { if (!cancelled) setError(err.message || "Couldn't load bookings."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── socket connection status indicator ──
  useEffect(() => {
    const onConnect    = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // ── real-time update handler ──
  const handleBookingUpdate = useCallback((payload) => {
    const { bookingId, status, message } = payload;

    // patch the booking in-place without re-fetching the whole list
    setBookings((prev) =>
      prev.map((b) =>
        (b._id === bookingId || b.id === bookingId)
          ? { ...b, status }
          : b
      )
    );

    // show a brief notification
    setLiveToast({ message, status });
    setTimeout(() => setLiveToast(null), 4000);
  }, []);

  useBookingSocket(handleBookingUpdate);

  // ── cancel a booking ──
  const handleCancel = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    setCancelling(bookingId);
    try {
      const res = await bookingService.cancel(bookingId, "Cancelled by user");
      // update immediately from the API's own response — don't make
      // the user's own action wait on a socket round-trip to show up.
      // The socket event (booking:statusUpdated) still arrives right
      // after and re-applies the same status, which is harmless.
      setBookings((prev) =>
        prev.map((b) => (b._id === bookingId ? { ...b, status: res.data.status } : b))
      );
    } catch (err) {
      alert(err.message || "Couldn't cancel. Please try again.");
    } finally {
      setCancelling(null);
    }
  };

  // ── permanently remove a cancelled/completed booking from the list ──
  const handleDelete = async (bookingId) => {
    if (!window.confirm("Remove this booking permanently? This can't be undone.")) return;
    setDeleting(bookingId);
    try {
      await bookingService.remove(bookingId);
      setBookings((prev) => prev.filter((b) => b._id !== bookingId));
    } catch (err) {
      alert(err.message || "Couldn't delete. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  // ── reschedule a confirmed booking ──
  const startReschedule = (bookingId) => {
    setReschedulingId(bookingId);
    setExpandedId(bookingId); // the picker lives in the expanded panel
    setRescheduleDate(null);
    setRescheduleTime("");
    setRescheduleError("");
  };

  const cancelReschedule = () => {
    setReschedulingId(null);
    setRescheduleDate(null);
    setRescheduleTime("");
    setRescheduleError("");
  };

  const confirmReschedule = async (bookingId) => {
    if (!rescheduleDate || !rescheduleTime) return;
    setRescheduleSubmitting(true);
    setRescheduleError("");
    try {
      const res = await bookingService.reschedule(bookingId, {
        newDate: rescheduleDate,
        newTime: rescheduleTime,
      });
      // patch the booking in place with the confirmed new date/time
      setBookings((prev) =>
        prev.map((b) =>
          b._id === bookingId
            ? { ...b, date: res.data?.newDate ?? rescheduleDate, time: rescheduleTime, hasRescheduled: true }
            : b
        )
      );
      cancelReschedule();
    } catch (err) {
      setRescheduleError(err.message || "Couldn't reschedule. Please try again.");
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  return (
    <div className="container-page py-16 sm:py-20">
      <div className="max-w-3xl mx-auto">

        {/* header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <p className="meta-caption mb-2">Your account</p>
            <h1 className="font-display text-4xl text-ink">My bookings</h1>
          </div>

          {/* live connection indicator */}
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 border text-[12px] font-mono",
            socketConnected
              ? "border-signature/20 bg-signature-tint text-signature-soft"
              : "border-line bg-paper-dim text-mist"
          )}>
            {socketConnected
              ? <><Wifi className="h-3 w-3" strokeWidth={1.5} /> Live</>
              : <><WifiOff className="h-3 w-3" strokeWidth={1.5} /> Offline</>
            }
          </div>
        </div>

        {/* real-time toast */}
        <AnimatePresence>
          {liveToast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "flex items-start gap-3 mb-6 px-4 py-3 border text-[13.5px]",
                STATUS_META[liveToast.status]?.bg,
                STATUS_META[liveToast.status]?.border,
                STATUS_META[liveToast.status]?.color,
              )}
            >
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.5} />
              <span>{liveToast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-line p-6 animate-pulse">
                <div className="h-4 bg-line rounded w-1/3 mb-3" />
                <div className="h-3 bg-line rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="border border-dashed border-line-strong py-16 text-center">
            <AlertCircle className="h-6 w-6 text-mist mx-auto mb-3" strokeWidth={1.5} />
            <p className="font-display text-lg text-ink mb-1">Couldn't load bookings</p>
            <p className="text-sm text-mist">{error}</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="border border-dashed border-line-strong py-20 text-center">
            <CalendarDays className="h-6 w-6 text-mist mx-auto mb-4" strokeWidth={1.5} />
            <p className="font-display text-xl text-ink mb-2">No bookings yet</p>
            <p className="text-sm text-mist mb-6">Book a photography session or camera rental to get started.</p>
            <Button variant="signature" asChild>
              <Link to="/packages">Browse packages</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const meta = STATUS_META[booking.status] ?? STATUS_META["Pending"];
              const isExpanded = expandedId === booking._id;
              const canCancel = ["Pending", "Payment Done", "Confirmed"].includes(booking.status);
              const canDelete = ["Cancelled", "Completed"].includes(booking.status);
              const isCancelling = cancelling === booking._id;
              const isDeleting = deleting === booking._id;

              // item name — prefer the live populated package/camera, fall
              // back to the snapshot taken at booking time
              const itemName = booking.type === "rental"
                ? [booking.camera?.brand, booking.camera?.model].filter(Boolean).join(" ") || booking.cameraSnapshot?.name
                : booking.package?.name || booking.packageSnapshot?.name;

              // every item included in the package / rental kit
              const includedItems = booking.type === "rental"
                ? (booking.camera?.accessories ?? []).map((a) => a.name)
                : booking.package?.includes ?? [];

              return (
                <motion.div
                  key={booking._id}
                  layout
                  className="border border-line overflow-hidden"
                >
                  {/* booking row */}
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      {/* left — booking info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <p className="font-display text-[17px] text-ink leading-tight truncate">
                            {itemName || "Booking"}
                          </p>
                          <span className={cn(
                            "px-2 py-0.5 text-[11.5px] font-mono border shrink-0",
                            meta.bg, meta.border, meta.color
                          )}>
                            {meta.label}
                          </span>
                        </div>

                        <Link
                          to={`/bookings/${booking._id}`}
                          className="meta-caption mb-3 inline-block hover:text-signature transition-colors"
                        >
                          {booking.bookingRef}
                        </Link>

                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-mist">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.5} />
                            {formatBookingDate(booking.date)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                            {booking.time}
                          </span>
                          {booking.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
                              {booking.location}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* right — amount + expand toggle */}
                      <div className="text-right shrink-0">
                        {booking.amount?.total != null && (
                          <p className="font-display text-lg text-ink mb-1">
                            {formatINR(booking.amount.total)}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : booking._id)}
                          className="meta-caption !text-mist hover:!text-signature transition-colors flex items-center gap-1 ml-auto"
                        >
                          {isExpanded ? "Less" : "More"}
                          {isExpanded
                            ? <ChevronUp className="h-3 w-3" strokeWidth={2} />
                            : <ChevronDown className="h-3 w-3" strokeWidth={2} />}
                        </button>
                      </div>
                    </div>

                    {/* status-specific actions */}
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-line">
                      {booking.status === "Pending" && (
                        <Button variant="signature" size="sm" asChild>
                          {/* dedicated route — loads the booking fresh from
                              GET /api/bookings/:id, so this keeps working
                              even after closing the tab and coming back later */}
                          <Link to={`/pay/${booking._id}`}>
                            Complete payment
                          </Link>
                        </Button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => handleCancel(booking._id)}
                          disabled={isCancelling}
                          className="flex items-center gap-1.5 h-9 px-3.5 rounded-[2px] border border-red-200 text-[12.5px] font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {isCancelling ? "Cancelling…" : "Cancel"}
                        </button>
                      )}
                      {booking.status === "Confirmed" && booking.isReschedulable && (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-[12.5px] text-mist hover:text-signature transition-colors"
                          onClick={() => startReschedule(booking._id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                          Reschedule
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(booking._id)}
                          disabled={isDeleting}
                          className="flex items-center gap-1.5 h-9 px-3.5 rounded-[2px] border border-line text-[12.5px] font-medium text-mist hover:bg-paper-dim hover:text-ink hover:border-line-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          {isDeleting ? "Removing…" : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* expanded detail */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden border-t border-line bg-paper-dim"
                      >
                        <div className="px-5 sm:px-6 py-5 grid sm:grid-cols-2 gap-4 text-[13.5px]">
                          <Detail label="Type" value={booking.type === "photography" ? "Photography session" : "Camera rental"} />
                          <Detail label="Booking ref" value={booking.bookingRef} mono />
                          <Detail label="Status" value={meta.label} />
                          {booking.type === "rental" && booking.rentalType && (
                            <Detail label="Rental type" value={booking.rentalType} />
                          )}
                          {booking.type === "rental" && booking.selectedAccessories?.length > 0 && (
                            <Detail label="Selected add-ons" value={booking.selectedAccessories.join(", ")} />
                          )}
                          {booking.type === "rental" && booking.withPhotographer && (
                            <Detail label="Add-on" value="With photographer" />
                          )}
                          {includedItems.length > 0 && (
                            <div className="sm:col-span-2">
                              <p className="meta-caption mb-1.5">
                                {booking.type === "rental" ? "Kit includes" : "What's included"}
                              </p>
                              <ul className="space-y-1">
                                {includedItems.map((inc, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-ink-soft">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-signature shrink-0 mt-0.5" strokeWidth={1.5} />
                                    <span>{inc}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {booking.notes && (
                            <div className="sm:col-span-2">
                              <Detail label="Notes" value={booking.notes} />
                            </div>
                          )}
                          {booking.amount && (
                            <div className="sm:col-span-2 border-t border-line pt-4 flex justify-between items-baseline">
                              <span className="text-mist">Total</span>
                              <span className="font-display text-xl text-ink">{formatINR(booking.amount.total)}</span>
                            </div>
                          )}

                          {/* inline reschedule picker */}
                          {reschedulingId === booking._id && (
                            <div className="sm:col-span-2 border-t border-line pt-5 mt-1">
                              <p className="meta-caption mb-3">Pick a new date</p>
                              <AvailabilityCalendar
                                selectedDate={rescheduleDate}
                                onSelectDate={setRescheduleDate}
                                scope="general"
                              />
                              {rescheduleDate && (
                                <div className="mt-5">
                                  <p className="meta-caption mb-3">Pick a new time</p>
                                  <div className="grid grid-cols-5 gap-2">
                                    {TIME_SLOTS.map((slot) => (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() => setRescheduleTime(slot)}
                                        className={cn(
                                          "py-2 text-[13px] border transition-colors",
                                          rescheduleTime === slot ? "bg-ink text-paper border-ink" : "text-ink-soft border-line hover:border-ink"
                                        )}
                                      >
                                        {slot}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {rescheduleError && (
                                <p className="text-[13px] font-mono text-red-500/90 mt-4">{rescheduleError}</p>
                              )}
                              <div className="flex items-center gap-3 mt-5">
                                <Button
                                  variant="signature"
                                  size="sm"
                                  onClick={() => confirmReschedule(booking._id)}
                                  disabled={!rescheduleDate || !rescheduleTime || rescheduleSubmitting}
                                >
                                  {rescheduleSubmitting ? "Rescheduling…" : "Confirm new date"}
                                </Button>
                                <button
                                  type="button"
                                  onClick={cancelReschedule}
                                  className="meta-caption !text-mist hover:!text-ink transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, mono = false }) {
  return (
    <div>
      <p className="meta-caption mb-0.5">{label}</p>
      <p className={cn("text-ink", mono && "font-mono text-[12.5px]")}>{value}</p>
    </div>
  );
}
