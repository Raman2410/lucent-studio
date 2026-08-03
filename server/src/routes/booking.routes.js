"use strict";

const express = require("express");
const router = express.Router();

const {
  createBooking,
  getMyBookings,
  getBookingById,
  rescheduleBooking,
  cancelBooking,
  updateBookingStatus,
  adminCancelBooking,
  deleteBooking,
  getOverdueBookings,
} = require("../controllers/booking.controller");

const { protect, restrictTo } = require("../middlewares/auth.middleware");

const {
  validate,
  bookingSchemas,
} = require("../middlewares/validate.middleware");

// ─────────────────────────────────────────
// ALL BOOKING ROUTES — JWT required
// lazy auth — triggered on booking action
// ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Booking lifecycle management
 */

// POST /api/bookings — create new booking
router.post("/", protect, validate(bookingSchemas.create), createBooking);

// GET /api/bookings/my — user's own bookings
router.get(
  "/my",
  protect,
  validate(bookingSchemas.myBookingsQuery, "query"),
  getMyBookings,
);

// GET /api/bookings/overdue — admin only
// must be registered before "/:id" or Express will treat "overdue"
// as an :id param and route it to getBookingById instead.
router.get("/overdue", protect, restrictTo("admin"), getOverdueBookings);

// GET /api/bookings/:id
router.get(
  "/:id",
  protect,
  validate(bookingSchemas.idParam, "params"),
  getBookingById,
);

// PATCH /api/bookings/:id/reschedule
router.patch(
  "/:id/reschedule",
  protect,
  validate(bookingSchemas.idParam, "params"),
  validate(bookingSchemas.reschedule),
  rescheduleBooking,
);

// PATCH /api/bookings/:id/cancel
router.patch(
  "/:id/cancel",
  protect,
  validate(bookingSchemas.idParam, "params"),
  cancelBooking,
);

// PATCH /api/bookings/:id/status — admin only
// SECURITY FIX: this route previously had no auth middleware at all —
// any unauthenticated request could change any booking's status.
router.patch(
  "/:id/status",
  protect,
  restrictTo("admin"),
  validate(bookingSchemas.idParam, "params"),
  updateBookingStatus,
);

// PATCH /api/bookings/:id/admin-cancel — admin only
// cancels any booking on the customer's behalf (same refund flow
// as the self-service cancel above, ownership check skipped)
router.patch(
  "/:id/admin-cancel",
  protect,
  restrictTo("admin"),
  validate(bookingSchemas.idParam, "params"),
  adminCancelBooking,
);

// DELETE /api/bookings/:id
// permanently removes a Completed or Cancelled booking record.
// Users may delete their own; admins may delete any (ownership
// check happens inside deleteBooking).
router.delete(
  "/:id",
  protect,
  validate(bookingSchemas.idParam, "params"),
  deleteBooking,
);

module.exports = router;
