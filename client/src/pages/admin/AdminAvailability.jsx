import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import availabilityService from "@/services/availabilityService";
import { StatusBanner } from "@/components/ui/status-banner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { WEEKDAYS, getMonthKey, stepMonth, getLeadingBlanks, isBeforeCurrentMonth } from "@/lib/calendarUtils";
import { CalendarMonthNav, LegendItem } from "@/components/booking/CalendarParts";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * AdminAvailability — the admin-facing counterpart to
 * AvailabilityCalendar.jsx. Reads the same GET /api/availability/:month
 * endpoint for the grid, then adds the write actions that only an
 * admin can hit: POST /block and DELETE /unblock/:date.
 *
 * A day is one of:
 *   - past            → greyed out, not clickable
 *   - fully booked     ("booking" blockType) → can't be manually
 *     unblocked here; it clears itself when the booking is cancelled
 *   - admin blocked     (holiday / maintenance) → click to unblock
 *   - open              → click to block
 */
export default function AdminAvailability() {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [scope, setScope] = useState("general");

  const [calendar, setCalendar] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null);

  const [blockedDates, setBlockedDates] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(true);

  const [blockModalDate, setBlockModalDate] = useState(null); // "YYYY-MM-DD" | null
  const [reason, setReason] = useState("");
  const [blockScope, setBlockScope] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [unblockingDate, setUnblockingDate] = useState(null);

  const { year, month } = cursor;
  const monthKey = getMonthKey(year, month);

  const fetchCalendar = useCallback(() => {
    setLoading(true);
    setError("");
    availabilityService
      .getMonth(monthKey, scope)
      .then((res) => {
        setCalendar(res.data?.calendar ?? []);
        setSummary(res.data?.summary ?? null);
      })
      .catch((err) => setError(err.message || "Couldn't load availability."))
      .finally(() => setLoading(false));
  }, [monthKey, scope]);

  const fetchBlockedDates = useCallback(() => {
    setBlockedLoading(true);
    availabilityService
      .getBlockedDates()
      .then((res) => setBlockedDates(res.data ?? []))
      .catch(() => setBlockedDates([]))
      .finally(() => setBlockedLoading(false));
  }, []);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);
  useEffect(() => { fetchBlockedDates(); }, [fetchBlockedDates]);

  const changeMonth = (delta) => {
    setCursor((prev) => stepMonth(prev, delta));
  };

  const openBlockModal = (day) => {
    if (day.isPast || (day.isBlocked && day.blockType === "booking")) return;
    if (day.isAdminBlocked) {
      handleUnblock(day.date);
      return;
    }
    setBlockModalDate(day.date);
    setReason("");
    setBlockScope("all");
    setBanner(null);
  };

  const handleBlock = async (e) => {
    e.preventDefault();
    if (!blockModalDate) return;
    setSubmitting(true);
    try {
      await availabilityService.blockDate(blockModalDate, reason, blockScope);
      setBlockModalDate(null);
      setBanner({ type: "success", message: `${blockModalDate} blocked.` });
      fetchCalendar();
      fetchBlockedDates();
    } catch (err) {
      setBanner({ type: "error", message: err.message || "Couldn't block that date." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnblock = async (date) => {
    setUnblockingDate(date);
    setBanner(null);
    try {
      const res = await availabilityService.unblockDate(date);
      setBanner({
        type: res.data?.isBlocked ? "error" : "success",
        message: res.message || (res.data?.isBlocked
          ? `${date} still blocked — bookings exist on that day.`
          : `${date} unblocked.`),
      });
      fetchCalendar();
      fetchBlockedDates();
    } catch (err) {
      setBanner({ type: "error", message: err.message || "Couldn't unblock that date." });
    } finally {
      setUnblockingDate(null);
    }
  };

  const leadingBlanks = calendar ? getLeadingBlanks(year, month) : 0;
  const canGoPrev = !isBeforeCurrentMonth(year, month);

  return (
    <div className="container-page py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-xl text-ink">Availability</h1>
          <p className="text-[13px] text-mist mt-0.5">
            Block dates for holidays or maintenance, or free up a date you blocked earlier.
          </p>
        </div>

        <div className="flex items-center gap-1 border border-line rounded-sm p-0.5">
          {["general", "wedding"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                "px-3 h-8 text-[13px] font-mono rounded-sm transition-colors capitalize",
                scope === s ? "bg-ink text-paper" : "text-mist hover:text-ink"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <StatusBanner status={banner} onDismiss={() => setBanner(null)} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── calendar ── */}
        <div className="border border-line rounded-sm overflow-hidden select-none">
          <CalendarMonthNav
            year={year}
            month={month}
            onChange={changeMonth}
            canGoPrev={canGoPrev}
            caption={
              summary && !loading
                ? `${summary.availableDays} open · ${summary.adminBlockedDays} blocked`
                : null
            }
          />

          <div className="grid grid-cols-7 px-4 pt-3 pb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="meta-caption text-center !text-mist-light py-1">{d}</div>
            ))}
          </div>

          <div className="px-4 pb-4 min-h-[260px]">
            {loading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-md" />
                ))}
              </div>
            ) : error ? (
              <p className="text-[13px] font-mono text-red-500/80 text-center py-14">{error}</p>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}

                {calendar.map((day) => {
                  const dayNum = parseInt(day.date.split("-")[2], 10);
                  const fullyBooked = day.isBlocked && day.blockType === "booking";
                  const adminBlocked = day.isAdminBlocked;
                  const isPast = day.isPast;
                  const isWorking = unblockingDate === day.date;
                  const clickable = !isPast && !fullyBooked && !isWorking;

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => openBlockModal(day)}
                      disabled={!clickable}
                      title={
                        isPast ? "Past date"
                          : fullyBooked ? `Fully booked (${day.bookingCount}/${day.maxBookingsPerDay})`
                          : adminBlocked ? `${day.reason || "Blocked"} — click to unblock`
                          : "Click to block this date"
                      }
                      className={cn(
                        "relative aspect-square flex flex-col items-center justify-center gap-0.5 text-[13px] font-mono transition-all duration-150 rounded-sm",
                        isPast && "text-mist-light/40 cursor-not-allowed line-through decoration-mist-light/30",
                        !isPast && fullyBooked && "text-mist-light/50 cursor-not-allowed bg-line/60",
                        !isPast && adminBlocked && "bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer",
                        !isPast && !fullyBooked && !adminBlocked && "text-ink hover:bg-signature-tint hover:text-signature cursor-pointer",
                      )}
                    >
                      {isWorking ? (
                        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <>
                          <span>{dayNum}</span>
                          {adminBlocked && <Lock className="h-2.5 w-2.5" strokeWidth={2} />}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 border-t border-line bg-paper-dim">
            <LegendItem color="bg-red-100 border border-red-300" label="Blocked / holiday" />
            <LegendItem color="bg-line-strong" label="Fully booked" />
            <LegendItem color="bg-mist-light/30" label="Past" />
          </div>
        </div>

        {/* ── upcoming blocked dates ── */}
        <div className="border border-line rounded-sm">
          <div className="px-4 py-3 border-b border-line bg-paper-dim">
            <p className="font-display text-[14px] text-ink">Upcoming blocks</p>
          </div>
          <div className="divide-y divide-line max-h-[420px] overflow-y-auto">
            {blockedLoading ? (
              <div className="h-32 flex items-center justify-center text-mist-light">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              </div>
            ) : blockedDates.length === 0 ? (
              <p className="text-[13px] text-mist-light text-center py-10 px-4">
                No dates blocked right now.
              </p>
            ) : (
              blockedDates.map((b) => {
                const dateStr = new Date(b.date).toISOString().split("T")[0];
                return (
                  <div key={b._id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-mono text-ink">{dateStr}</p>
                        <span className="text-[10.5px] font-mono uppercase tracking-wide text-mist-light border border-line rounded-sm px-1 py-px">
                          {b.scope || "general"}
                        </span>
                      </div>
                      <p className="text-[12px] text-mist truncate">{b.reason || "No reason given"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblock(dateStr)}
                      disabled={unblockingDate === dateStr}
                      className="shrink-0 h-7 w-7 flex items-center justify-center text-mist hover:text-signature transition-colors disabled:opacity-40"
                      aria-label={`Unblock ${dateStr}`}
                    >
                      {unblockingDate === dateStr
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                        : <Unlock className="h-3.5 w-3.5" strokeWidth={1.5} />}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── block date modal ── */}
      <Modal open={!!blockModalDate} onClose={() => setBlockModalDate(null)} title={`Block ${blockModalDate ?? ""}`}>
        <form onSubmit={handleBlock} className="space-y-5">
          <FormField
            id="block-reason"
            label="Reason (optional)"
            as="textarea"
            rows={3}
            placeholder="e.g. Personal holiday, equipment maintenance"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
          />

          <div className="flex flex-col gap-1.5">
            <label className="meta-caption">Applies to</label>
            <Select value={blockScope} onChange={(e) => setBlockScope(e.target.value)}>
              <option value="all">Both calendars (general + wedding)</option>
              <option value="general">General bookings only</option>
              <option value="wedding">Wedding bookings only</option>
            </Select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setBlockModalDate(null)}
              disabled={submitting}
              className="px-4 h-9 text-[13px] font-medium text-ink border border-line rounded-[2px] hover:bg-paper-dim transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Blocking…" : "Block date"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
