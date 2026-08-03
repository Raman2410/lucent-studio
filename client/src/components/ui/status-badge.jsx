import { cn } from "@/lib/utils";

/**
 * StatusBadge — shared booking-status pill used across AdminDashboard,
 * AdminBookings, and BookingDetail's timeline. Extracted here so the
 * color mapping only lives in one place (previously duplicated inline
 * inside AdminDashboard.jsx).
 */
export const STATUS_STYLES = {
  Pending: "bg-gold-tint text-gold border-gold/30",
  "Payment Done": "bg-signature-tint text-signature border-signature/25",
  Confirmed: "bg-signature-tint text-signature border-signature/25",
  "In Progress": "bg-paper-dim text-ink border-line-strong",
  Completed: "bg-signature text-paper border-signature",
  Cancelled: "bg-red-50 text-red-600 border-red-200",
};

export function StatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border font-mono",
        STATUS_STYLES[status] || "bg-paper-dim text-mist border-line",
        className,
      )}
    >
      {status}
    </span>
  );
}
