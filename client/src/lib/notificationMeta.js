import {
  CalendarPlus,
  IndianRupee,
  CalendarX,
  CalendarCheck,
  CalendarClock,
  MessageCircleQuestion,
  Bell,
} from "lucide-react";

/**
 * NOTIFICATION_META — icon + accent color per notification type.
 * Mirrors the STATUS_STYLES pattern in status-badge.jsx: one lookup
 * table so the bell dropdown, toasts, and any future surface (email
 * digest, admin activity feed) render the same event consistently.
 */
export const NOTIFICATION_META = {
  booking_created: {
    icon: CalendarPlus,
    accent: "text-signature bg-signature-tint border-signature/25",
  },
  payment_received: {
    icon: IndianRupee,
    accent: "text-gold bg-gold-tint border-gold/30",
  },
  booking_cancelled: {
    icon: CalendarX,
    accent: "text-red-600 bg-red-50 border-red-200",
  },
  booking_confirmed: {
    icon: CalendarCheck,
    accent: "text-signature bg-signature-tint border-signature/25",
  },
  booking_rescheduled: {
    icon: CalendarClock,
    accent: "text-ink bg-paper-dim border-line-strong",
  },
  booking_status_changed: {
    icon: CalendarClock,
    accent: "text-ink bg-paper-dim border-line-strong",
  },
  query_created: {
    icon: MessageCircleQuestion,
    accent: "text-signature bg-signature-tint border-signature/25",
  },
};

export function getNotificationMeta(type) {
  return NOTIFICATION_META[type] || { icon: Bell, accent: "text-ink bg-paper-dim border-line-strong" };
}

/**
 * Relative time formatting for notification timestamps — "2m ago",
 * "3h ago", "5d ago", falling back to a short date beyond a week.
 */
export function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
