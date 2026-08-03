"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────
// NOTIFICATION SCHEMA
// persisted in-app notifications, delivered
// live over Socket.io and readable later from
// the bell dropdown (survives refresh/relogin)
// ─────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         recipient:
 *           type: string
 *           description: User ID reference — who this notification is for
 *         audience:
 *           type: string
 *           enum: [user, admin]
 *         type:
 *           type: string
 *           enum: [booking_created, payment_received, booking_cancelled, booking_confirmed, booking_rescheduled, booking_status_changed, query_created]
 *         title:
 *           type: string
 *           example: "New Booking"
 *         message:
 *           type: string
 *           example: "Priya Sharma booked the Wedding Premium package"
 *         data:
 *           type: object
 *           description: Small payload for deep-linking (bookingId, queryId, etc.)
 *         read:
 *           type: boolean
 */
const notificationSchema = new mongoose.Schema(
  {
    // who should see this notification.
    // for audience: "admin" notifications, recipient is the specific
    // admin user's _id — one document per admin, so per-admin read
    // state and pagination both work without extra bookkeeping.
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
    },

    audience: {
      type: String,
      enum: ["user", "admin"],
      required: true,
      default: "user",
    },

    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: {
        values: [
          "booking_created",
          "payment_received",
          "booking_cancelled",
          "booking_confirmed",
          "booking_rescheduled",
          "booking_status_changed",
          "query_created",
        ],
        message: "Invalid notification type",
      },
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 120,
    },

    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: 500,
    },

    // small deep-link payload — e.g. { bookingId, bookingRef } or
    // { queryId }. Kept intentionally small; not a document snapshot.
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    read: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────
notificationSchema.index({ recipient: 1, createdAt: -1 }); // list, newest first
notificationSchema.index({ recipient: 1, read: 1 }); // unread count
// auto-delete notifications after 90 days — keeps the collection
// bounded without a manual cleanup job
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 },
);

// ─────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────

/**
 * Get unread count for a user
 * @param {string} userId
 * @returns {Promise<number>}
 */
notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({ recipient: userId, read: false });
};

/**
 * Mark all of a user's notifications as read
 * @param {string} userId
 */
notificationSchema.statics.markAllRead = function (userId) {
  return this.updateMany(
    { recipient: userId, read: false },
    { read: true, readAt: new Date() },
  );
};

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
