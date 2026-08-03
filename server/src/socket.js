"use strict";

const jwt = require("jsonwebtoken");
const User = require("./models/User.model");
const Booking = require("./models/Booking.model");

// ─────────────────────────────────────────
// CONNECTED USERS MAP
// tracks which socket belongs to which user
// Map<userId, socketId>
// allows server to emit to specific user
// ─────────────────────────────────────────
const connectedUsers = new Map();

// ─────────────────────────────────────────
// SOCKET AUTH MIDDLEWARE
// verifies JWT before allowing connection
// unauthenticated sockets connect but get
// limited functionality (public events only)
// ─────────────────────────────────────────
const socketAuthMiddleware = async (socket, next) => {
  try {
    // token can come from:
    // 1. handshake auth object  { auth: { token: "..." } }
    // 2. handshake query params { query: { token: "..." } }
    const token =
      socket.handshake.auth?.token || socket.handshake.query?.token || null;

    if (!token) {
      // allow connection without auth — public socket
      socket.user = null;
      return next();
    }

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      "_id name email role",
    );

    if (!user) {
      socket.user = null;
      return next();
    }

    socket.user = user;
    next();
  } catch (error) {
    // invalid token — allow as unauthenticated
    socket.user = null;
    next();
  }
};

// ─────────────────────────────────────────
// REGISTER ALL SOCKET EVENTS
// called in server.js after io is created
// ─────────────────────────────────────────
const registerSocketEvents = (io) => {
  // apply auth middleware to all connections
  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    const userId = socket.user?._id?.toString();

    // ── CONNECTION ──────────────────────
    if (userId) {
      // store mapping: userId → socketId
      connectedUsers.set(userId, socket.id);

      // join personal room — used to send private events
      // room name = userId (string)
      socket.join(userId);

      // admins additionally join the shared "admin-room" —
      // the dashboard listens here for live activity pushes
      if (socket.user.role === "admin") {
        socket.join("admin-room");
      }

      console.log(
        `🔌 Socket connected: ${socket.id} | User: ${socket.user.name} (${userId})`,
      );
    } else {
      console.log(`🔌 Socket connected: ${socket.id} | Guest`);
    }

    // ── PING / PONG ─────────────────────
    // client sends ping to check connection
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: new Date().toISOString() });
    });

    // ── JOIN BOOKING ROOM ───────────────
    // client joins a room specific to a booking
    // allows real-time updates for that booking
    socket.on("booking:join", async ({ bookingId }) => {
      if (!bookingId) return;

      if (!socket.user) {
        return socket.emit("error", {
          message: "Authentication required to track booking",
        });
      }

      try {
        // ownership check — without this, any authenticated user could
        // join booking:<any-id> just by guessing/enumerating IDs and
        // silently receive another customer's live status, reschedule,
        // and refund updates. Admins can track any booking.
        const booking = await Booking.findById(bookingId).select("user");

        if (!booking) {
          return socket.emit("error", { message: "Booking not found" });
        }

        const isOwner = booking.user.toString() === socket.user._id.toString();
        const isAdmin = socket.user.role === "admin";

        if (!isOwner && !isAdmin) {
          return socket.emit("error", {
            message: "You do not have permission to track this booking",
          });
        }

        const roomName = `booking:${bookingId}`;
        socket.join(roomName);
        console.log(`📋 Socket ${socket.id} joined room: ${roomName}`);

        socket.emit("booking:joined", {
          bookingId,
          message: "Now tracking real-time updates for this booking",
        });
      } catch (error) {
        console.error(`❌ booking:join error [${socket.id}]:`, error.message);
        socket.emit("error", { message: "Could not join booking room" });
      }
    });

    // ── LEAVE BOOKING ROOM ──────────────
    socket.on("booking:leave", ({ bookingId }) => {
      if (!bookingId) return;
      const roomName = `booking:${bookingId}`;
      socket.leave(roomName);
      console.log(`📋 Socket ${socket.id} left room: ${roomName}`);
    });

    // ── DISCONNECT ──────────────────────
    socket.on("disconnect", (reason) => {
      if (userId) {
        connectedUsers.delete(userId);
        console.log(
          `❌ Socket disconnected: ${socket.id} | User: ${userId} | Reason: ${reason}`,
        );
      } else {
        console.log(
          `❌ Socket disconnected: ${socket.id} | Guest | Reason: ${reason}`,
        );
      }
    });

    // ── ERROR HANDLER ───────────────────
    socket.on("error", (error) => {
      console.error(`❌ Socket error [${socket.id}]:`, error.message);
    });
  });

  console.log("✅ Socket.io events registered");
};

// ─────────────────────────────────────────
// EMIT HELPERS
// called from controllers after DB updates
// controllers access io via req.app.get("io")
// ─────────────────────────────────────────

/**
 * Emit booking status update to:
 *   1. the booking's room (booking:{bookingId})
 *   2. the user's personal room (userId)
 *
 * @param {object} io         — Socket.io server instance
 * @param {string} bookingId  — MongoDB booking _id
 * @param {string} userId     — MongoDB user _id
 * @param {string} status     — new booking status
 * @param {object} extra      — any additional data to send
 */
const emitBookingUpdate = (io, bookingId, userId, status, extra = {}) => {
  const payload = {
    bookingId,
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };

  // emit to booking room — anyone tracking this booking sees it
  io.to(`booking:${bookingId}`).emit("booking:statusUpdated", payload);

  // emit to user's personal room — user sees it on their bookings list
  io.to(userId.toString()).emit("booking:statusUpdated", payload);

  // also push to the admin dashboard
  emitAdminActivity(io, "booking:statusUpdated", {
    bookingId,
    status,
  });

  console.log(
    `📡 Emitted booking:statusUpdated → booking: ${bookingId} | status: ${status}`,
  );
};

/**
 * Emit booking confirmed event after payment
 * @param {object} io
 * @param {string} bookingId
 * @param {string} userId
 * @param {object} bookingData — summary data for UI
 */
const emitBookingConfirmed = (io, bookingId, userId, bookingData = {}) => {
  emitBookingUpdate(io, bookingId, userId, "Confirmed", {
    event: "booking:confirmed",
    message: "Your booking has been confirmed! Check your email for details.",
    ...bookingData,
  });
};

/**
 * Emit booking cancelled event
 * @param {object} io
 * @param {string} bookingId
 * @param {string} userId
 * @param {boolean} refundInitiated
 */
const emitBookingCancelled = (
  io,
  bookingId,
  userId,
  refundInitiated = false,
) => {
  emitBookingUpdate(io, bookingId, userId, "Cancelled", {
    event: "booking:cancelled",
    refundInitiated,
    message: refundInitiated
      ? "Booking cancelled. Refund will be processed in 5-7 business days."
      : "Booking cancelled.",
  });
};

/**
 * Emit booking rescheduled event
 * @param {object} io
 * @param {string} bookingId
 * @param {string} userId
 * @param {string} newDate
 * @param {string} newTime
 */
const emitBookingRescheduled = (io, bookingId, userId, newDate, newTime) => {
  emitBookingUpdate(io, bookingId, userId, "Confirmed", {
    event: "booking:rescheduled",
    newDate,
    newTime,
    message: `Booking rescheduled to ${newDate} at ${newTime}.`,
  });
};

/**
 * Emit booking in progress event
 * @param {object} io
 * @param {string} bookingId
 * @param {string} userId
 */
const emitBookingInProgress = (io, bookingId, userId) => {
  emitBookingUpdate(io, bookingId, userId, "In Progress", {
    event: "booking:inProgress",
    message: "Your session has started!",
  });
};

/**
 * Emit booking completed event
 * @param {object} io
 * @param {string} bookingId
 * @param {string} userId
 */
const emitBookingCompleted = (io, bookingId, userId) => {
  emitBookingUpdate(io, bookingId, userId, "Completed", {
    event: "booking:completed",
    message: "Your session is complete. Thank you for choosing us!",
  });
};

/**
 * Push a live activity event to every connected admin.
 * Dashboard listens for "admin:activity" and refetches/updates
 * the relevant widget (sales trend, camera status, recent bookings).
 *
 * @param {object} io
 * @param {string} event   — short event key, e.g. "booking:created"
 * @param {object} payload — small summary, not the full document
 */
const emitAdminActivity = (io, event, payload = {}) => {
  io.to("admin-room").emit("admin:activity", {
    event,
    at: new Date().toISOString(),
    ...payload,
  });
};

/**
 * Check if a specific user is currently connected via WebSocket
 * @param {string} userId
 * @returns {boolean}
 */
const isUserConnected = (userId) => {
  return connectedUsers.has(userId.toString());
};

/**
 * Get total number of connected sockets
 * @returns {number}
 */
const getConnectedUsersCount = () => connectedUsers.size;

module.exports = {
  registerSocketEvents,
  emitAdminActivity,
  emitBookingUpdate,
  emitBookingConfirmed,
  emitBookingCancelled,
  emitBookingRescheduled,
  emitBookingInProgress,
  emitBookingCompleted,
  isUserConnected,
  getConnectedUsersCount,
};
