import { useEffect, useState, useRef } from "react";
import { useParams, useLocation as useRouterLocation } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import AvailabilityCalendar from "@/components/booking/AvailabilityCalendar";
import BookingPaymentPanel from "@/components/booking/BookingPaymentPanel";
import packageService from "@/services/packageService";
import cameraService from "@/services/cameraService";
import bookingService from "@/services/bookingService";
import { cn } from "@/lib/utils";

const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00",
];

const RENTAL_TYPES = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekend", label: "Weekend" },
];

const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);

/**
 * Booking — single flow handling BOTH booking types the backend
 * supports (see bookingSchemas.create in validate.middleware.js):
 *   type: "photography" — books a Package, needs packageId
 *   type: "rental"       — books a Camera, needs cameraId + rentalType
 *
 * Route wiring (in App.jsx):
 *   /book/session/:packageId  -> <Booking type="photography" />
 *   /book/rental/:cameraId    -> <Booking type="rental" />
 *
 * On success, the backend returns a Pending booking and says
 * "Proceed to payment to confirm" — BookingPaymentPanel then takes
 * over and opens real Razorpay checkout.
 *
 * Resuming payment on an existing Pending booking later (e.g. after
 * closing the tab) is handled by the dedicated /pay/:bookingId route
 * (see pages/Pay.jsx) instead of this page, since that flow doesn't
 * need the package/camera item this page loads.
 */
export default function Booking({ type }) {
  const params = useParams();
  const routerLocation = useRouterLocation();
  const itemId = type === "photography" ? params.packageId : params.cameraId;

  const [item, setItem] = useState(null);
  const [itemLoading, setItemLoading] = useState(true);
  const [itemError, setItemError] = useState("");

  // pre-fill date if the user came via /availability → /packages → here
  const [date, setDate] = useState(routerLocation.state?.preselectedDate ?? null);
  const [endDate, setEndDate] = useState(null);
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // rental-only state
  const [rentalType, setRentalType] = useState("daily");
  const [rentalMode, setRentalMode] = useState("single"); // "single" | "range"
  const [selectedAccessories, setSelectedAccessories] = useState([]);
  const [withPhotographer, setWithPhotographer] = useState(false);
  const [costBreakdown, setCostBreakdown] = useState(null);
  const [costLoading, setCostLoading] = useState(false);
  const costDebounce = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmation, setConfirmation] = useState(null); // booking result on success

  // wedding/marriage packages: on-site the whole event, staffed by
  // dedicated wedding photographers — always booked as a date range
  // (own availability calendar) with no time-slot picker.
  const isWedding = type === "photography" && item?.category === "wedding";
  // camera rentals: a multi-day rental doesn't need a time slot either —
  // renter has the camera for the whole span.
  const isMultiDayRental = type === "rental" && rentalMode === "range";
  const multiDay = isWedding || isMultiDayRental;

  const numberOfDays = (() => {
    if (!multiDay || !date || !endDate) return 1;
    const ms = new Date(endDate) - new Date(date);
    return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
  })();

  // ── load the package/camera being booked ──
  useEffect(() => {
    let cancelled = false;
    setItemLoading(true);
    setItemError("");

    const fetch = type === "photography" ? packageService.getById(itemId) : cameraService.getById(itemId);
    fetch
      .then((res) => { if (!cancelled) setItem(res.data); })
      .catch((err) => { if (!cancelled) setItemError(err.message || "Couldn't load this item."); })
      .finally(() => { if (!cancelled) setItemLoading(false); });

    return () => { cancelled = true; };
  }, [type, itemId]);

  // ── live rental cost recalculation (debounced) ──
  useEffect(() => {
    if (type !== "rental" || !item) return;
    // multi-day cost depends on having both ends of the range picked
    if (isMultiDayRental && (!date || !endDate)) {
      setCostBreakdown(null);
      return;
    }
    clearTimeout(costDebounce.current);
    costDebounce.current = setTimeout(() => {
      setCostLoading(true);
      cameraService
        .calculateCost(itemId, {
          rentalType: isMultiDayRental ? "daily" : rentalType,
          quantity: isMultiDayRental ? numberOfDays : 1,
          accessories: selectedAccessories,
          withPhotographer,
        })
        .then((res) => setCostBreakdown(res.data))
        .catch(() => setCostBreakdown(null))
        .finally(() => setCostLoading(false));
    }, 350);
    return () => clearTimeout(costDebounce.current);
  }, [type, item, itemId, rentalType, selectedAccessories, withPhotographer, isMultiDayRental, date, endDate, numberOfDays]);

  const toggleAccessory = (name) => {
    setSelectedAccessories((prev) => (prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]));
  };

  const handleRentalModeChange = (mode) => {
    if (mode === rentalMode) return;
    setRentalMode(mode);
    setDate(null);
    setEndDate(null);
    setTime("");
  };

  const canSubmit = multiDay ? Boolean(date && endDate) : Boolean(date && time) && (type === "photography" || rentalType);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError("");

    const payload =
      type === "photography"
        ? {
            type,
            packageId: itemId,
            date,
            ...(isWedding ? { endDate } : { time }),
            location,
            notes,
          }
        : {
            type,
            cameraId: itemId,
            rentalType: isMultiDayRental ? "daily" : rentalType,
            accessories: selectedAccessories,
            withPhotographer,
            date,
            ...(isMultiDayRental ? { endDate } : { time }),
            location,
            notes,
          };

    try {
      const res = await bookingService.create(payload);
      setConfirmation(res.data);
    } catch (err) {
      setSubmitError(err.message || "Couldn't create the booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // the booking form is long, so by the time someone hits "Request
  // booking" they're usually scrolled to the bottom of the page.
  // Swapping in the confirmation/payment panel below re-renders in
  // place — without resetting scroll, it lands below the fold and
  // looks like it "slides up from the bottom" as the user scrolls
  // down to find it. Snap back to the top the moment it appears.
  useEffect(() => {
    if (confirmation) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [confirmation]);

  // ── pending confirmation — booking exists, payment still needed ──
  if (confirmation) {
    const includedItems =
      type === "photography"
        ? item.includes ?? []
        : (item.accessories ?? []).map((a) => a.name);

    return (
      <BookingPaymentPanel
        booking={{
          ...confirmation,
          itemName: item.name,
          includedItems,
          rentalType: type === "rental" ? (isMultiDayRental ? "daily" : rentalType) : undefined,
          selectedAccessories: type === "rental" ? selectedAccessories : undefined,
          withPhotographer: type === "rental" ? withPhotographer : undefined,
        }}
      />
    );
  }

  if (itemLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-mist-light">
        <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.5} />
      </div>
    );
  }

  if (itemError || !item) {
    return (
      <div className="container-page py-24 text-center">
        <p className="font-display text-xl text-ink mb-2">Couldn't load this {type === "photography" ? "package" : "camera"}</p>
        <p className="text-sm text-mist">{itemError}</p>
      </div>
    );
  }

  return (
    <div className="container-page py-16 sm:py-20">
      <div className="max-w-2xl mx-auto">
        {/* summary header */}
        <div className="mb-10 pb-8 border-b border-line">
          <p className="meta-caption mb-2">{type === "photography" ? "Book a session" : "Book a rental"}</p>
          <h1 className="font-display text-3xl text-ink mb-2">{item.name}</h1>
          {type === "photography" ? (
            <p className="text-mist text-sm">
              {item.category}
              {item.duration?.value ? ` · ${item.duration.value} ${item.duration.unit}` : ""} ·{" "}
              <span className="text-ink">{formatINR(item.price?.amount)}</span>
            </p>
          ) : (
            <p className="text-mist text-sm">
              {item.brand} {item.model} · From <span className="text-ink">{formatINR(item.rentalRates?.daily)}</span>/day
            </p>
          )}
        </div>

        {/* rental-specific options */}
        {type === "rental" && (
          <div className="mb-10 pb-8 border-b border-line space-y-6">
            <div>
              <p className="meta-caption mb-3">How long do you need it?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRentalModeChange("single")}
                  className={cn(
                    "px-4 py-2 text-[13px] border transition-colors",
                    rentalMode === "single" ? "bg-ink text-paper border-ink" : "text-ink-soft border-line hover:border-ink"
                  )}
                >
                  Just one day
                </button>
                <button
                  type="button"
                  onClick={() => handleRentalModeChange("range")}
                  className={cn(
                    "px-4 py-2 text-[13px] border transition-colors",
                    rentalMode === "range" ? "bg-ink text-paper border-ink" : "text-ink-soft border-line hover:border-ink"
                  )}
                >
                  Multiple days
                </button>
              </div>
            </div>

            {rentalMode === "single" ? (
              <div>
                <p className="meta-caption mb-3">Rental duration</p>
                <div className="flex gap-2">
                  {RENTAL_TYPES.map((rt) => (
                    <button
                      key={rt.value}
                      type="button"
                      onClick={() => setRentalType(rt.value)}
                      className={cn(
                        "px-4 py-2 text-[13px] border transition-colors",
                        rentalType === rt.value ? "bg-ink text-paper border-ink" : "text-ink-soft border-line hover:border-ink"
                      )}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-mist-light mt-2">Pick a date and time slot below.</p>
              </div>
            ) : (
              <p className="text-[12px] text-mist-light">
                Pick your first and last day below — billed at the daily rate, no time slot needed since you'll have the camera the whole time.
              </p>
            )}

            {item.accessories?.length > 0 && (
              <div>
                <p className="meta-caption mb-3">Accessories</p>
                <div className="flex flex-wrap gap-2">
                  {item.accessories.filter((a) => a.isAvailable).map((acc) => (
                    <button
                      key={acc.name}
                      type="button"
                      onClick={() => toggleAccessory(acc.name)}
                      className={cn(
                        "px-3.5 py-2 text-[12.5px] border transition-colors",
                        selectedAccessories.includes(acc.name) ? "bg-signature text-paper border-signature" : "text-ink-soft border-line hover:border-ink"
                      )}
                    >
                      {acc.name}{acc.additionalCharge > 0 ? ` · +${formatINR(acc.additionalCharge)}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.photographerAddon?.available && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={withPhotographer}
                  onChange={(e) => setWithPhotographer(e.target.checked)}
                  className="h-4 w-4 accent-signature"
                />
                <span className="text-[13.5px] text-ink">
                  Add a photographer — +{formatINR(item.photographerAddon.chargePerHour)}/hr
                </span>
              </label>
            )}

            {/* live cost breakdown */}
            <div className="bg-paper-dim px-4 py-3.5 flex items-center justify-between">
              <span className="meta-caption">
                Estimated total{isMultiDayRental && numberOfDays > 1 ? ` · ${numberOfDays} days` : ""}
              </span>
              {costLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-mist" strokeWidth={1.5} />
              ) : (
                <span className="font-display text-lg text-ink">
                  {isMultiDayRental && (!date || !endDate) ? "—" : formatINR(costBreakdown?.breakdown?.total)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* wedding packages: on-site the whole event — no time slot needed */}
        {isWedding && (
          <div className="mb-6 -mt-4 pb-0">
            <p className="text-[12px] text-mist-light">
              Pick your first and last day below — we'll have a dedicated wedding photographer with you the entire time, no time slot needed.
            </p>
          </div>
        )}

        {/* date + time */}
        <div className="mb-10 pb-8 border-b border-line">
          <p className="meta-caption mb-3">Choose {multiDay ? "your dates" : "a date"}</p>
          <AvailabilityCalendar
            selectedDate={date}
            onSelectDate={setDate}
            scope={isWedding ? "wedding" : "general"}
            rangeMode={multiDay}
            selectedEndDate={endDate}
            onSelectRange={(start, end) => { setDate(start); setEndDate(end); }}
          />

          {!multiDay && date && (
            <div className="mt-6">
              <p className="meta-caption mb-3">Choose a time</p>
              <div className="grid grid-cols-5 gap-2">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTime(slot)}
                    className={cn(
                      "py-2 text-[13px] border transition-colors",
                      time === slot ? "bg-ink text-paper border-ink" : "text-ink-soft border-line hover:border-ink"
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* location + notes */}
        <div className="mb-10 pb-8 border-b border-line space-y-5">
          <div>
            <p className="meta-caption mb-2">Location (optional)</p>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Studio, or your preferred location"
              maxLength={200}
              className="w-full bg-transparent border-0 border-b border-line-strong py-2.5 text-[15px] text-ink placeholder:text-mist-light focus:outline-none focus:border-b-signature transition-colors"
            />
          </div>
          <div>
            <p className="meta-caption mb-2">Notes (optional)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything we should know ahead of time"
              maxLength={500}
              rows={3}
              className="w-full bg-transparent border border-line-strong px-3 py-2.5 text-[14px] text-ink placeholder:text-mist-light focus:outline-none focus:border-signature transition-colors resize-none"
            />
          </div>
        </div>

        {submitError && (
          <p className="text-[13px] font-mono text-red-500/90 mb-4">{submitError}</p>
        )}

        <div className="flex items-center gap-3">
          <Button variant="primary" size="lg" onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Submitting…" : "Request booking"}
          </Button>
          <p className="flex items-center gap-1.5 text-[12px] text-mist-light">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
            Bookings require 48hrs notice
          </p>
        </div>
      </div>
    </div>
  );
}
