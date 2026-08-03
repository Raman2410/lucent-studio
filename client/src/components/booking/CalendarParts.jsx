import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMonthLabel } from "@/lib/calendarUtils";

/**
 * CalendarMonthNav — the prev/next-month header bar shared by every
 * month-grid calendar (AvailabilityCalendar, AdminAvailability).
 * `caption` renders under the month label — pass whatever per-view
 * summary line makes sense (available days, blocked days, etc).
 * `canGoPrev` is passed in rather than computed here because the two
 * callers disagree on the rule: the booking calendar locks out the
 * current month too (customers can't browse into the past), while the
 * admin view allows stepping further back for record-keeping.
 */
export function CalendarMonthNav({ year, month, onChange, caption, canGoPrev }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-paper-dim">
      <button
        type="button"
        onClick={() => onChange(-1)}
        disabled={!canGoPrev}
        aria-label="Previous month"
        className="h-8 w-8 flex items-center justify-center text-ink-soft hover:text-signature disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
      </button>

      <div className="text-center">
        <p className="font-display text-[15px] text-ink leading-tight">
          {getMonthLabel(year, month)}
        </p>
        {caption && <p className="meta-caption !text-mist-light mt-0.5">{caption}</p>}
      </div>

      <button
        type="button"
        onClick={() => onChange(1)}
        aria-label="Next month"
        className="h-8 w-8 flex items-center justify-center text-ink-soft hover:text-signature transition-colors"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/** Single dot + label legend entry, e.g. "● Fully booked". */
export function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-sm inline-block", color)} />
      <span className="meta-caption !text-mist-light">{label}</span>
    </div>
  );
}
