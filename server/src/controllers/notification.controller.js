"use strict";

const Notification = require("../models/Notification.model");
const { AppError } = require("../middlewares/error.middleware");
const { sendSuccess, STATUS, paginationMeta } = require("../utils/apiResponse");

// ─────────────────────────────────────────
// GET MY NOTIFICATIONS
// GET /api/notifications
// protected — returns the current user's own
// notifications (customer or admin — the
// `recipient` field already scopes this per
// authenticated user)
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get current user's notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: List of notifications, newest first
 */
const getMyNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === "true";

    const filter = { recipient: req.user._id };
    if (unreadOnly) filter.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(filter),
      Notification.getUnreadCount(req.user._id),
    ]);

    return sendSuccess(
      res,
      STATUS.OK,
      "Notifications fetched",
      { notifications, unreadCount },
      paginationMeta(total, page, limit),
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET UNREAD COUNT
// GET /api/notifications/unread-count
// lightweight — used to badge the bell icon
// without fetching the full list
// ─────────────────────────────────────────
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.getUnreadCount(req.user._id);
    return sendSuccess(res, STATUS.OK, "Unread count fetched", { count });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// MARK ONE NOTIFICATION READ
// PATCH /api/notifications/:id/read
// ─────────────────────────────────────────
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id, // ownership check — can't mark others' notifications
    });

    if (!notification) {
      return next(new AppError("Notification not found", STATUS.NOT_FOUND));
    }

    if (!notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      await notification.save();
    }

    return sendSuccess(res, STATUS.OK, "Notification marked as read", {
      notification,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// MARK ALL NOTIFICATIONS READ
// PATCH /api/notifications/read-all
// ─────────────────────────────────────────
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.markAllRead(req.user._id);
    return sendSuccess(res, STATUS.OK, "All notifications marked as read");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
