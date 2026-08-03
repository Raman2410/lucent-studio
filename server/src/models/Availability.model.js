"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────
// AVAILABILITY SCHEMA
// single unified calendar for all bookings
// both photography sessions and camera rentals
// block a date → no new bookings accepted
//
// Redis caching layer sits on top:
// GET  /api/availability/:month
//   → check Redis (key: "availability:2024-08")
//   → HIT  → return cached
//   → MISS → query this collection → cache → return
//
// Cache invalidated on:
//   → new booking created
//   → booking cancelled
//   → booking rescheduled
//   → admin blocks/unblocks a date
// ─────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Availability:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *           example: "2024-08-15"
 *         isBlocked:
 *           type: boolean
 *           example: true
 *         blockType:
 *           type: string
 *           enum: [booking, admin, maintenance, holiday]
 *           example: "booking"
 *         bookingCount:
 *           type: number
 *           example: 2
 *         maxBookingsPerDay:
 *           type: number
 *           example: 3
 *         reason:
 *           type: string
 *           example: "Fully booked"
 */
const availabilitySchema = new mongoose.Schema(
  {
    // stored as UTC midnight — one document per (date, scope) pair
    date: {
      type: Date,
      required: [true, "Date is required"],
    },

    // which calendar this record belongs to.
    // "general" — non-wedding photography sessions + camera rentals
    //             (shared capacity, same as before)
    // "wedding" — marriage/wedding packages, staffed by dedicated
    //             wedding photographers, so it is tracked completely
    //             separately from the general calendar. A date can be
    //             fully booked on one calendar and wide open on the
    //             other.
    scope: {
      type: String,
      enum: {
        values: ["general", "wedding"],
        message: "Invalid availability scope",
      },
      default: "general",
    },

    // is this date fully blocked?
    // true when bookingCount >= maxBookingsPerDay OR admin manually blocks
    isBlocked: {
      type: Boolean,
      default: false,
    },

    // why is this date blocked?
    blockType: {
      type: String,
      enum: {
        values: ["booking", "admin", "maintenance", "holiday"],
        message: "Invalid block type",
      },
      default: null,
    },

    // human-readable reason shown to users
    reason: {
      type: String,
      trim: true,
      maxlength: [200, "Reason cannot exceed 200 characters"],
      default: "",
    },

    // how many bookings are on this date
    // auto-incremented when a booking is confirmed
    // auto-decremented when a booking is cancelled
    bookingCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // max bookings allowed per day
    // when bookingCount reaches this → isBlocked = true automatically
    maxBookingsPerDay: {
      type: Number,
      default: 3, // photographer can handle max 3 sessions per day
      min: 1,
    },

    // references to bookings on this date
    // used for admin visibility — who is booked on this day
    bookingRefs: {
      type: [
        {
          bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
          },
          type: {
            type: String,
            enum: ["photography", "rental"],
          },
          time: {
            type: String, // HH:MM — for time-slot awareness
          },
        },
      ],
      default: [],
    },

    // was this date manually blocked by admin?
    isAdminBlocked: {
      type: Boolean,
      default: false,
    },

    // admin block metadata
    adminBlock: {
      blockedAt: { type: Date, default: null },
      reason: { type: String, default: "" },
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
// one record per date PER SCOPE — replaces the old single-date unique index
availabilitySchema.index({ date: 1, scope: 1 }, { unique: true });
availabilitySchema.index({ isBlocked: 1 }); // fetch only available dates
availabilitySchema.index({ scope: 1, date: 1, isBlocked: 1 }); // compound — month range queries per calendar

// ─────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────

// remaining slots for the day
availabilitySchema.virtual("remainingSlots").get(function () {
  return Math.max(0, this.maxBookingsPerDay - this.bookingCount);
});

// is date partially booked (has bookings but not fully blocked)
availabilitySchema.virtual("isPartiallyBooked").get(function () {
  return this.bookingCount > 0 && !this.isBlocked;
});

// formatted date string — YYYY-MM-DD
availabilitySchema.virtual("dateString").get(function () {
  return this.date.toISOString().split("T")[0];
});

// ─────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────

/**
 * Increment booking count and auto-block if max reached
 * Called when a booking is confirmed on this date
 * @param {string} bookingId
 * @param {string} type — "photography" | "rental"
 * @param {string} time — HH:MM
 */
availabilitySchema.methods.addBooking = async function (bookingId, type, time) {
  this.bookingCount += 1;
  this.bookingRefs.push({ bookingId, type, time });

  // auto-block when max bookings reached
  if (this.bookingCount >= this.maxBookingsPerDay) {
    this.isBlocked = true;
    this.blockType = "booking";
    this.reason = "Fully booked";
  }

  return this.save();
};

/**
 * Decrement booking count and unblock if below max
 * Called when a booking is cancelled
 * @param {string} bookingId
 */
availabilitySchema.methods.removeBooking = async function (bookingId) {
  this.bookingCount = Math.max(0, this.bookingCount - 1);
  this.bookingRefs = this.bookingRefs.filter(
    (ref) => ref.bookingId.toString() !== bookingId.toString(),
  );

  // unblock if below max AND not admin-blocked
  if (this.bookingCount < this.maxBookingsPerDay && !this.isAdminBlocked) {
    this.isBlocked = false;
    this.blockType = null;
    this.reason = "";
  }

  return this.save();
};

// ─────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────

/**
 * Get availability for a full month
 * Returns all dates in the month with their status
 * Used by the real-time calendar on frontend
 * Results cached in Redis — key: "availability:YYYY-MM"
 *
 * @param {string} month — "YYYY-MM" e.g. "2024-08"
 * @param {string} scope — "general" | "wedding" (default: "general")
 * @returns {Array} availability documents for the month
 */
availabilitySchema.statics.getMonthAvailability = async function (
  month,
  scope = "general",
) {
  const [year, monthNum] = month.split("-").map(Number);

  const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
  const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59)); // last day of month

  const records = await this.find({
    date: { $gte: startDate, $lte: endDate },
    scope,
  })
    .select(
      "date isBlocked blockType reason bookingCount maxBookingsPerDay isAdminBlocked",
    )
    .sort({ date: 1 });

  return records;
};

/**
 * Check if a specific date is available
 * @param {Date|string} date
 * @param {string} scope — "general" | "wedding" (default: "general")
 * @returns {{ available: boolean, reason: string, remainingSlots: number }}
 */
availabilitySchema.statics.checkDate = async function (date, scope = "general") {
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  const record = await this.findOne({ date: targetDate, scope });

  // if no record exists — date is fully open
  if (!record) {
    return {
      available: true,
      reason: "",
      remainingSlots: 3, // default maxBookingsPerDay
    };
  }

  return {
    available: !record.isBlocked,
    reason: record.reason || "",
    remainingSlots: record.remainingSlots,
  };
};

/**
 * Get or create an availability record for a date
 * Used internally when creating bookings
 * @param {Date} date
 * @param {string} scope — "general" | "wedding" (default: "general")
 * @returns {Document} availability document
 */
availabilitySchema.statics.getOrCreate = async function (date, scope = "general") {
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  let record = await this.findOne({ date: targetDate, scope });

  if (!record) {
    // A wedding package occupies the venue/photographer for the whole
    // day, so unlike the general calendar (which can hold up to 3
    // separate sessions), a wedding date can only ever hold ONE booking.
    // Setting maxBookingsPerDay to 1 here means addBooking()'s existing
    // "bookingCount >= maxBookingsPerDay → auto-block" logic kicks in
    // the moment the first wedding booking is confirmed, automatically
    // blocking the date for any further wedding bookings — no manual
    // admin action required.
    const maxBookingsPerDay = scope === "wedding" ? 1 : 3;
    record = await this.create({ date: targetDate, scope, maxBookingsPerDay });
  }

  return record;
};

/**
 * Check availability across a date range (inclusive) — used for
 * multi-day wedding bookings and multi-day camera rentals.
 * A range is only "available" if EVERY date in it is open.
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {string} scope — "general" | "wedding" (default: "general")
 * @returns {{ available: boolean, reason: string, blockedDates: string[], days: number }}
 */
availabilitySchema.statics.checkDateRange = async function (
  startDate,
  endDate,
  scope = "general",
) {
  const dates = enumerateDates(startDate, endDate);
  const blockedDates = [];
  let reason = "";

  for (const d of dates) {
    // eslint-disable-next-line no-await-in-loop
    const result = await this.checkDate(d, scope);
    if (!result.available) {
      blockedDates.push(d.toISOString().split("T")[0]);
      if (!reason) reason = result.reason || "Date not available";
    }
  }

  return {
    available: blockedDates.length === 0,
    reason: blockedDates.length ? `${blockedDates.length} date(s) unavailable in this range: ${reason}` : "",
    blockedDates,
    days: dates.length,
  };
};

/**
 * Reserve every date in a range for a single multi-day booking.
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {string} bookingId
 * @param {string} type — "photography" | "rental"
 * @param {string} scope — "general" | "wedding" (default: "general")
 */
availabilitySchema.statics.addBookingRange = async function (
  startDate,
  endDate,
  bookingId,
  type,
  scope = "general",
) {
  const dates = enumerateDates(startDate, endDate);
  for (const d of dates) {
    // eslint-disable-next-line no-await-in-loop
    const record = await this.getOrCreate(d, scope);
    // eslint-disable-next-line no-await-in-loop
    await record.addBooking(bookingId, type, null);
  }
};

/**
 * Release every date in a range for a cancelled multi-day booking.
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {string} bookingId
 * @param {string} scope — "general" | "wedding" (default: "general")
 */
availabilitySchema.statics.removeBookingRange = async function (
  startDate,
  endDate,
  bookingId,
  scope = "general",
) {
  const dates = enumerateDates(startDate, endDate);
  for (const d of dates) {
    const targetDate = new Date(d);
    targetDate.setUTCHours(0, 0, 0, 0);
    // eslint-disable-next-line no-await-in-loop
    const record = await this.findOne({ date: targetDate, scope });
    if (record) {
      // eslint-disable-next-line no-await-in-loop
      await record.removeBooking(bookingId);
    }
  }
};

/**
 * Helper — build an array of UTC-midnight Date objects from
 * startDate to endDate inclusive.
 */
function enumerateDates(startDate, endDate) {
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Admin block a date manually
 * @param {Date|string} date
 * @param {string} reason
 * @param {string} scope — "general" | "wedding" (default: "general")
 * @returns {Document} updated availability record
 */
availabilitySchema.statics.adminBlock = async function (date, reason = "", scope = "general") {
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  const record = await this.findOneAndUpdate(
    { date: targetDate, scope },
    {
      $set: {
        isBlocked: true,
        blockType: "admin",
        isAdminBlocked: true,
        reason: reason || "Blocked by admin",
        adminBlock: {
          blockedAt: new Date(),
          reason: reason || "Blocked by admin",
        },
      },
    },
    { upsert: true, new: true },
  );

  return record;
};

/**
 * Admin unblock a date
 * Only unblocks if no bookings are present
 * If bookings exist — reverts to booking-based status
 * @param {Date|string} date
 * @param {string} scope — "general" | "wedding" (default: "general")
 * @returns {Document} updated availability record
 */
availabilitySchema.statics.adminUnblock = async function (date, scope = "general") {
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  const record = await this.findOne({ date: targetDate, scope });

  if (!record) return null;

  record.isAdminBlocked = false;
  record.adminBlock = { blockedAt: null, reason: "" };

  // re-evaluate block status based on bookings
  if (record.bookingCount >= record.maxBookingsPerDay) {
    record.isBlocked = true;
    record.blockType = "booking";
    record.reason = "Fully booked";
  } else {
    record.isBlocked = false;
    record.blockType = null;
    record.reason = "";
  }

  return record.save();
};

const Availability = mongoose.model("Availability", availabilitySchema);

module.exports = Availability;
