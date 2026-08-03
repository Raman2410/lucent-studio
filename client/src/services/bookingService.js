import api from "@/lib/api";

/**
 * bookingService — matches server/src/routes/booking.routes.js
 * ALL routes require auth (protect middleware) — api.js attaches
 * the Bearer token automatically once the user is logged in.
 *
 *   POST  /api/bookings                  create
 *   GET   /api/bookings/my               list mine
 *   GET   /api/bookings/:id              single
 *   PATCH /api/bookings/:id/reschedule
 *   PATCH /api/bookings/:id/cancel
 *   DELETE /api/bookings/:id       remove a Completed/Cancelled booking
 */
const bookingService = {
  create: (payload) => api.post("/bookings", payload),
  getMyBookings: (params = {}) => api.get("/bookings/my", { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  reschedule: (id, { newDate, newTime }) =>
    api.patch(`/bookings/${id}/reschedule`, { newDate, newTime }),
  cancel: (id, reason = "") => api.patch(`/bookings/${id}/cancel`, { reason }),
  remove: (id) => api.delete(`/bookings/${id}`),
};

export default bookingService;
