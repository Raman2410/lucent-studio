"use strict";

const express = require("express");
const router = express.Router();

const {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notification.controller");

const { protect } = require("../middlewares/auth.middleware");

const {
  validate,
  notificationSchemas,
} = require("../middlewares/validate.middleware");

// ─────────────────────────────────────────
// ALL NOTIFICATION ROUTES — JWT required
// scoped to the authenticated user's own
// notifications (customer or admin alike)
// ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Real-time in-app notifications
 */

// GET /api/notifications — list current user's notifications
router.get(
  "/",
  protect,
  validate(notificationSchemas.listQuery, "query"),
  getMyNotifications,
);

// GET /api/notifications/unread-count — badge count only
router.get("/unread-count", protect, getUnreadCount);

// PATCH /api/notifications/read-all — mark everything read
router.patch("/read-all", protect, markAllAsRead);

// PATCH /api/notifications/:id/read — mark one read
router.patch(
  "/:id/read",
  protect,
  validate(notificationSchemas.idParam, "params"),
  markAsRead,
);

module.exports = router;
