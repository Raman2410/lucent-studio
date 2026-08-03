import api from "@/lib/api";

/**
 * adminService — matches server/src/routes/admin.routes.js
 * All routes require auth + role "admin".
 *
 *   GET   /api/admin/overview
 *   GET   /api/admin/sales-trend?days=7
 *   GET   /api/admin/requests-trend?days=7
 *   GET   /api/admin/cameras-status
 *   GET   /api/admin/bookings/recent?limit=10
 *   GET   /api/admin/bookings?search=&status=&type=&dateFrom=&dateTo=&page=&limit=
 *   PATCH /api/bookings/:id/status   { status, note }  (admin only —
 *         lives under /api/bookings, not /api/admin, but included here
 *         since it's an admin action used from the same pages)
 */
const adminService = {
  getOverview: () => api.get("/admin/overview"),
  getSalesTrend: (days = 7) =>
    api.get("/admin/sales-trend", { params: { days } }),
  getRequestsTrend: (days = 7) =>
    api.get("/admin/requests-trend", { params: { days } }),
  getCameraStatus: () => api.get("/admin/cameras-status"),
  getRecentBookings: (limit = 10) =>
    api.get("/admin/bookings/recent", { params: { limit } }),

  // full searchable/filterable/paginated bookings list
  getAllBookings: (params = {}) => api.get("/admin/bookings", { params }),

  // admin can only move a booking to "In Progress" or "Completed" —
  // enforced server-side too, this just mirrors the same contract
  updateBookingStatus: (bookingId, { status, note = "" }) =>
    api.patch(`/bookings/${bookingId}/status`, { status, note }),

  // admin cancels any booking on the customer's behalf (refund flow
  // identical to self-service cancel, ownership check skipped server-side)
  cancelBooking: (bookingId, reason = "") =>
    api.patch(`/bookings/${bookingId}/admin-cancel`, { reason }),

  // permanently removes a Completed or Cancelled booking record —
  // enforced server-side; active bookings can't be deleted this way
  deleteBooking: (bookingId) => api.delete(`/bookings/${bookingId}`),
};

export default adminService;
