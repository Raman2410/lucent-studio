"use strict";

const express = require("express");
const router = express.Router();

const {
  getOverview,
  getSalesTrend,
  getRequestsTrend,
  getCameraRentalStatus,
  getRecentBookings,
  getAllBookings,
} = require("../controllers/admin.controller");

const { protect, restrictTo } = require("../middlewares/auth.middleware");

// ─────────────────────────────────────────
// ALL ADMIN ROUTES — JWT + role "admin" required
// ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin dashboard analytics
 */

router.use(protect, restrictTo("admin"));

// GET /api/admin/overview
router.get("/overview", getOverview);

// GET /api/admin/sales-trend?days=7
router.get("/sales-trend", getSalesTrend);

// GET /api/admin/requests-trend?days=7
router.get("/requests-trend", getRequestsTrend);

// GET /api/admin/cameras-status
router.get("/cameras-status", getCameraRentalStatus);

// GET /api/admin/bookings/recent?limit=10
router.get("/bookings/recent", getRecentBookings);

// GET /api/admin/bookings — full list with search, filters, pagination
router.get("/bookings", getAllBookings);

module.exports = router;
