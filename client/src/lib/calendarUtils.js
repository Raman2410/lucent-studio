/**
 * calendarUtils — small date-math helpers shared by every month-grid
 * calendar in the app (AvailabilityCalendar, AdminAvailability). Kept
 * here instead of duplicated per-component so the "what counts as the
 * current/past month" logic can't drift between the customer-facing
 * and admin views.
 */

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "YYYY-MM" key matching the server's GET /api/availability/:month format */
export function getMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isBeforeCurrentMonth(year, month) {
  const now = new Date();
  return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
}

export function isCurrentMonth(year, month) {
  const now = new Date();
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

/** Step a {year, month} cursor forward/back by `delta` months, wrapping year boundaries. */
export function stepMonth({ year, month }, delta) {
  let m = month + delta;
  let y = year;
  if (m > 12) { m = 1; y += 1; }
  if (m < 1) { m = 12; y -= 1; }
  return { year: y, month: m };
}

/** Long month label, e.g. "August 2026". */
export function getMonthLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** Number of blank leading cells before day 1 lands on the right weekday column. */
export function getLeadingBlanks(year, month) {
  return new Date(year, month - 1, 1).getDay();
}
