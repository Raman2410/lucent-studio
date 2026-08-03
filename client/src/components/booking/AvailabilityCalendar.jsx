import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import availabilityService from "@/services/availabilityService";
import { WEEKDAYS, getMonthKey, stepMonth, getLeadingBlanks, isBeforeCurrentMonth, isCurrentMonth } from "@/lib/calendarUtils";
import { CalendarMonthNav, LegendItem } from "@/components/booking/CalendarParts";

/**
 * AvailabilityCalendar — month-view date picker wired to the real
 * availability endpoints. Used by both photography-session and
 * camera-rental booking flows (they share the same Availability
 * collection server-side).
 *
 * Backend response shapes this component reads:
 *
 * GET /api/availability/:month  → {
 *   month, summary,
 *   calendar: [{
 *     date, isBlocked, isPast, blockType,   // "past"|"booking"|"admin"|null
 *     reason, bookingCount, maxBookingsPerDay,
 *     remainingSlots, isAdminBlocked
 *   }]
 * }
 *
 * GET /api/availability/check?date=  → {
 *   date, available, reason, remainingSlots
 * }
 *
 * Two-step confirmation on every date click, matching the server's
 * own two-tier check:
 *   1. Month view quickly colors the grid from cached data — but it
 *      does NOT encode the 48-hour advance-booking rule (a date that
 *      looks open on the grid can still fail the check if it's < 48
 *      hours away).
 *   2. On click, /check?date= re-confirms including the 48hr rule —
 *      the parent booking form only receives a date that the backend
 *      itself agrees is bookable.
 */

const TODAY = new Date();
TODAY.setUTCHours(0, 0, 0, 0);

export default function AvailabilityCalendar({
  selectedDate,
  onSelectDate,
  scope = "general",
  rangeMode = false,
  selectedEndDate = null,
  onSelectRange,
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [calendar, setCalendar] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingDate, setCheckingDate] = useState(null);
  const [dateNote, setDateNote] = useState(null);
  // range mode only — the first date the user clicked, waiting for
  // them to click a second (end) date
  const [pendingStart, setPendingStart] = useState(null);

  const { year, month } = cursor;
  const monthKey = getMonthKey(year, month);

  // fetch month data whenever cursor or scope changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setDateNote(null);

    availabilityService
      .getMonth(monthKey, scope)
      .then((res) => {
        if (cancelled) return;
        setCalendar(res.data?.calendar ?? []);
        setSummary(res.data?.summary ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Couldn't load availability.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [monthKey, scope]);

  // switching modes (or the item being booked) clears any in-progress selection
  useEffect(() => {
    setPendingStart(null);
    setDateNote(null);
  }, [rangeMode, scope]);

  const changeMonth = (delta) => {
    setCursor((prev) => stepMonth(prev, delta));
  };

  const handleDayClick = useCallback(async (day) => {
    if (day.isBlocked) return;

    // ── RANGE MODE ── pick a start date, then an end date ──
    if (rangeMode) {
      // no start picked yet (or previous range already confirmed) — start a new range
      if (!pendingStart) {
        setPendingStart(day.date);
        setDateNote(null);
        onSelectRange?.(null, null);
        return;
      }

      // clicked before the pending start — restart with this as the new start
      if (day.date < pendingStart) {
        setPendingStart(day.date);
        return;
      }

      // this click is the end date — validate the whole range
      setCheckingDate(day.date);
      setDateNote(null);
      try {
        const res = await availabilityService.checkRange(pendingStart, day.date, scope);
        const checkData = res.data;
        if (checkData.available) {
          onSelectRange?.(pendingStart, day.date);
          setPendingStart(null);
          setDateNote(null);
        } else {
          setDateNote({ date: day.date, ...checkData, isRange: true });
          setPendingStart(null);
        }
      } catch (err) {
        setDateNote({
          date: day.date,
          available: false,
          reason: err.message || "Couldn't verify this date range.",
          isRange: true,
        });
        setPendingStart(null);
      } finally {
        setCheckingDate(null);
      }
      return;
    }

    // ── SINGLE-DATE MODE (original behaviour) ──
    setCheckingDate(day.date);
    setDateNote(null);

    try {
      const res = await availabilityService.checkDate(day.date, scope);
      const checkData = res.data;
      setDateNote({ date: day.date, ...checkData });
      if (checkData.available) onSelectDate(day.date);
    } catch (err) {
      setDateNote({
        date: day.date,
        available: false,
        reason: err.message || "Couldn't verify this date.",
      });
    } finally {
      setCheckingDate(null);
    }
  }, [onSelectDate, onSelectRange, rangeMode, pendingStart, scope]);

  // offset: how many blank cells before day 1
  const leadingBlanks = calendar ? getLeadingBlanks(year, month) : 0;

  const canGoPrev = !isBeforeCurrentMonth(year, month) && !isCurrentMonth(year, month);

  return (
    <div className="border border-line rounded-sm overflow-hidden select-none">
      <CalendarMonthNav
        year={year}
        month={month}
        onChange={changeMonth}
        canGoPrev={canGoPrev}
        caption={
          summary && !loading
            ? `${summary.availableDays} day${summary.availableDays !== 1 ? "s" : ""} available`
            : null
        }
      />

      {/* ── weekday row ── */}
      <div className="grid grid-cols-7 px-4 pt-3 pb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="meta-caption text-center !text-mist-light py-1">{d}</div>
        ))}
      </div>

      {/* ── day grid ── */}
      <div className="px-4 pb-4 min-h-[220px]">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-mist-light">
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
          </div>
        ) : error ? (
          <p className="text-[13px] font-mono text-red-500/80 text-center py-14">{error}</p>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* leading blanks */}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}

            {/* days */}
            {calendar.map((day) => {
              const dayNum = parseInt(day.date.split("-")[2], 10);
              const isSelected = !rangeMode && selectedDate === day.date;
              const isChecking = checkingDate === day.date;
              const almostFull = !day.isBlocked && day.remainingSlots === 1;
              const fullyBooked = day.isBlocked && day.blockType === "booking";
              const adminBlocked = day.isAdminBlocked;
              const isPast = day.isPast;

              // range-mode highlighting
              const isPendingStart = rangeMode && pendingStart === day.date;
              const isRangeEndpoint =
                rangeMode && (day.date === selectedDate || day.date === selectedEndDate);
              const isInConfirmedRange =
                rangeMode && selectedDate && selectedEndDate &&
                day.date > selectedDate && day.date < selectedEndDate;

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  disabled={day.isBlocked || isChecking}
                  title={
                    isPast ? "Past date"
                      : fullyBooked ? "Fully booked"
                      : adminBlocked ? (day.reason || "Unavailable")
                      : almostFull ? "Last slot remaining"
                      : undefined
                  }
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center text-[13px] font-mono transition-all duration-150 rounded-sm",
                    // base
                    !day.isBlocked && "hover:bg-signature-tint hover:text-signature cursor-pointer",
                    // past
                    isPast && "text-mist-light/40 cursor-not-allowed line-through decoration-mist-light/30",
                    // fully booked
                    !isPast && fullyBooked && "text-mist-light/50 cursor-not-allowed bg-line/60",
                    // admin blocked
                    !isPast && adminBlocked && !fullyBooked && "text-mist-light/40 cursor-not-allowed",
                    // normal available
                    !day.isBlocked && "text-ink",
                    // almost full
                    !day.isBlocked && almostFull && "text-gold",
                    // selected (single-date mode)
                    isSelected && "!bg-ink !text-paper hover:!bg-ink",
                    // range mode — dates between start/end
                    isInConfirmedRange && "!bg-signature-tint !text-signature-soft",
                    // range mode — the two endpoints or a start awaiting an end
                    (isRangeEndpoint || isPendingStart) && "!bg-ink !text-paper hover:!bg-ink",
                  )}
                >
                  {isChecking ? (
                    <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <>
                      <span>{dayNum}</span>
                      {/* slot indicators */}
                      {!day.isBlocked && !isSelected && !isRangeEndpoint && !isPendingStart && !isInConfirmedRange && (
                        <span className={cn(
                          "absolute bottom-1 h-1 w-1 rounded-full",
                          almostFull ? "bg-gold" : "opacity-0"
                        )} />
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── range-mode instructions ── */}
      {rangeMode && (
        <div className="px-5 py-2.5 border-t border-line bg-paper-dim">
          <p className="meta-caption !text-mist-light">
            {selectedDate && selectedEndDate
              ? `Selected ${selectedDate} → ${selectedEndDate}. Click any date to pick a new range.`
              : pendingStart
                ? `Start: ${pendingStart}. Now click your last day (click the same day again for a single day).`
                : "Click your first day, then your last day."}
          </p>
        </div>
      )}

      {/* ── legend ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 border-t border-line bg-paper-dim">
        <LegendItem color="bg-ink" label="Selected" />
        <LegendItem color="bg-gold" label="Last slot" />
        <LegendItem color="bg-line-strong" label="Fully booked" />
        <LegendItem color="bg-mist-light/30" label="Unavailable" />
      </div>

      {/* ── date check feedback — 48hr rule, slots, or error ── */}
      <AnimatePresence>
        {dateNote && (
          <motion.div
            key={dateNote.date}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "px-5 py-3 text-[13px] leading-relaxed border-t",
              dateNote.available
                ? "bg-signature-tint border-signature/20 text-signature-soft"
                : "bg-red-50 border-red-200 text-red-600"
            )}
          >
            {dateNote.available ? (
              dateNote.isRange ? (
                <span><strong>Available</strong> — this range is open.</span>
              ) : (
                <span>
                  <strong>{dateNote.date}</strong> — {dateNote.remainingSlots} slot{dateNote.remainingSlots !== 1 ? "s" : ""} remaining. Select a time below.
                </span>
              )
            ) : (
              <span>
                <strong>Not available:</strong> {dateNote.reason || "This date cannot be booked."}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
