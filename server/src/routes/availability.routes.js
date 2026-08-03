"use strict";

const express = require("express");
const router = express.Router();

const {
  getMonthAvailability,
  checkDateAvailability,
  checkRangeAvailability,
  blockDate,
  unblockDate,
  getBlockedDates,
} = require("../controllers/availability.controller");

const {
  validate,
  availabilitySchemas,
} = require("../middlewares/validate.middleware");

const { protect, restrictTo } = require("../middlewares/auth.middleware");

// ─────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Availability
 *   description: Real-time availability calendar
 */

// GET /api/availability/check?date=YYYY-MM-DD
router.get("/check", checkDateAvailability);

// GET /api/availability/check-range?startDate=&endDate=&scope=
router.get("/check-range", checkRangeAvailability);

// ─────────────────────────────────────────
// ADMIN ROUTES — JWT + admin role required
// registered BEFORE "/:month" — otherwise the generic month route
// would swallow "/blocked" (Express matches routes in order, and
// "/:month" matches any single path segment, "blocked" included)
// ─────────────────────────────────────────

// GET /api/availability/blocked — list all blocked dates
router.get("/blocked", protect, restrictTo("admin"), getBlockedDates);

// POST /api/availability/block
router.post(
  "/block",
  protect,
  restrictTo("admin"),
  validate(availabilitySchemas.blockDate),
  blockDate,
);

// DELETE /api/availability/unblock/:date?scope=
router.delete(
  "/unblock/:date",
  protect,
  restrictTo("admin"),
  validate(availabilitySchemas.unblockDate, "params"),
  validate(availabilitySchemas.unblockDateQuery, "query"),
  unblockDate,
);

// GET /api/availability/:month — YYYY-MM format — public, must come last
router.get(
  "/:month",
  validate(availabilitySchemas.getByMonth, "params"),
  getMonthAvailability,
);

module.exports = router;
