import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BookingTimeline — visual vertical timeline for a booking's
 * statusHistory (a real field already tracked by Booking.model.js's
 * updateStatus() method — every status change is pushed there with
 * a timestamp and note). This replaces what was previously just a
 * plain text list with no visual structure.
 *
 * history: [{ status, changedAt, note }]  — oldest first, as stored.
 */

const DOT_COLOR = {
  Pending: "bg-gold border-gold",
  "Payment Done": "bg-signature border-signature",
  Confirmed: "bg-signature border-signature",
  "In Progress": "bg-ink border-ink",
  Completed: "bg-signature border-signature",
  Cancelled: "bg-red-400 border-red-400",
};

const formatDateTime = (d) =>
  new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

export default function BookingTimeline({ history = [] }) {
  if (history.length === 0) return null;

  return (
    <ol className="relative">
      {history.map((h, i) => {
        const isLast = i === history.length - 1;
        return (
          <li key={i} className="relative pl-7 pb-6 last:pb-0">
            {/* connector line */}
            {!isLast && (
              <span className="absolute left-[5px] top-3 bottom-0 w-px bg-line" />
            )}

            {/* dot — every entry already happened, so all are filled with
                their status color; the current (last) one gets a ring
                for emphasis rather than different fill logic */}
            <span
              className={cn(
                "absolute left-0 top-1 h-[11px] w-[11px] rounded-full border-2",
                DOT_COLOR[h.status] || "bg-ink border-ink",
                isLast && "ring-2 ring-offset-2 ring-offset-paper ring-signature/30"
              )}
            />

            <div className="flex items-baseline justify-between gap-4">
              <p className={cn("text-[13.5px]", isLast ? "text-ink font-medium" : "text-ink-soft")}>
                {h.status}
              </p>
              <p className="text-[11.5px] font-mono text-mist-light shrink-0">
                {formatDateTime(h.changedAt)}
              </p>
            </div>
            {h.note && (
              <p className="text-[12.5px] text-mist mt-0.5">{h.note}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
