import api from "@/lib/api";

/**
 * availabilityService — matches server/src/routes/availability.routes.js
 *
 * There are actually TWO calendars server-side (Availability.model.js
 * "scope" field):
 *   "general" — non-wedding photography sessions + camera rentals
 *               (shared capacity, same as before)
 *   "wedding" — wedding/marriage packages, staffed by dedicated
 *               wedding photographers, tracked completely separately
 *
 * Every call below accepts an optional `scope` ("general" | "wedding",
 * defaults to "general" server-side when omitted).
 *
 *   GET    /api/availability/check?date=YYYY-MM-DD&scope=          single date
 *   GET    /api/availability/check-range?startDate=&endDate=&scope= date range
 *   GET    /api/availability/:month?scope=                          full month
 *
 * Admin-only (JWT + role "admin" required — see auth.middleware.js):
 *   GET    /api/availability/blocked                caption list of blocked dates
 *   POST   /api/availability/block       { date, reason }
 *   DELETE /api/availability/unblock/:date
 */
const availabilityService = {
  checkDate: (date, scope) =>
    api.get("/availability/check", { params: { date, scope } }),
  checkRange: (startDate, endDate, scope) =>
    api.get("/availability/check-range", { params: { startDate, endDate, scope } }),
  getMonth: (month, scope) =>
    api.get(`/availability/${month}`, { params: { scope } }),

  // ── admin ──
  getBlockedDates: () => api.get("/availability/blocked"),
  blockDate: (date, reason, scope = "all") =>
    api.post("/availability/block", { date, reason, scope }),
  unblockDate: (date, scope = "all") =>
    api.delete(`/availability/unblock/${date}`, { params: { scope } }),
};

export default availabilityService;
