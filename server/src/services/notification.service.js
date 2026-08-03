"use strict";

const Notification = require("../models/Notification.model");
const User = require("../models/User.model");

// ─────────────────────────────────────────
// NOTIFICATION SERVICE
// single entry point for "create + deliver".
// Every notification is persisted first (so it
// survives refresh/relogin/offline delivery),
// then pushed live over the socket if the
// recipient is currently connected — same
// event, same shape, so the client never has
// to distinguish "live" vs "fetched from API".
// ─────────────────────────────────────────

/**
 * Create one notification and emit it live to its recipient's
 * personal room ("<userId>"). Failures here are logged and
 * swallowed — a notification glitch must never break the booking/
 * payment/query flow that triggered it.
 *
 * @param {object} io              — Socket.io server instance (nullable)
 * @param {string} recipientId     — User _id
 * @param {"user"|"admin"} audience
 * @param {string} type            — Notification.type enum value
 * @param {string} title
 * @param {string} message
 * @param {object} data            — small deep-link payload
 * @returns {Promise<object|null>} the created notification (plain object) or null on failure
 */
const notify = async (io, recipientId, audience, type, title, message, data = {}) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      audience,
      type,
      title,
      message,
      data,
    });

    const payload = {
      _id: notification._id,
      audience: notification.audience,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      read: notification.read,
      createdAt: notification.createdAt,
    };

    if (io) {
      io.to(recipientId.toString()).emit("notification:new", payload);
    }

    return payload;
  } catch (error) {
    console.error(`⚠️  Notification create/emit failed [${type}]:`, error.message);
    return null;
  }
};

/**
 * Fan a notification out to every admin user — one persisted
 * document per admin, each delivered to that admin's personal
 * room. Used for events every admin should see (new booking,
 * payment received, cancellation, new contact query).
 *
 * @param {object} io
 * @param {string} type
 * @param {string} title
 * @param {string} message
 * @param {object} data
 */
const notifyAdmins = async (io, type, title, message, data = {}) => {
  try {
    const admins = await User.find({ role: "admin" }).select("_id");
    await Promise.all(
      admins.map((admin) =>
        notify(io, admin._id, "admin", type, title, message, data),
      ),
    );
  } catch (error) {
    console.error(`⚠️  Admin notification fan-out failed [${type}]:`, error.message);
  }
};

/**
 * Notify a single customer about their own booking/payment activity.
 * Thin wrapper kept separate from notifyAdmins for clarity at call sites.
 *
 * @param {object} io
 * @param {string} userId
 * @param {string} type
 * @param {string} title
 * @param {string} message
 * @param {object} data
 */
const notifyUser = (io, userId, type, title, message, data = {}) =>
  notify(io, userId, "user", type, title, message, data);

module.exports = {
  notify,
  notifyAdmins,
  notifyUser,
};
