"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────
// BOOKING SCHEMA
// ─────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Booking:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         user:
 *           type: string
 *           description: User ID reference
 *         type:
 *           type: string
 *           enum: [photography, rental]
 *         status:
 *           type: string
 *           enum: [Pending, Payment Done, Confirmed, In Progress, Completed, Cancelled]
 *         date:
 *           type: string
 *           format: date-time
 *         amount:
 *           type: object
 *           properties:
 *             subtotal:
 *               type: number
 *             total:
 *               type: number
 *             currency:
 *               type: string
 */
const bookingSchema = new mongoose.Schema(
  {
    // ─────────────────────────────────────
    // CORE REFERENCES
    // ─────────────────────────────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    // booking type — determines which sub-fields are used
    type: {
      type: String,
      required: [true, "Booking type is required"],
      enum: {
        values: ["photography", "rental"],
        message: "Booking type must be photography or rental",
      },
    },

    // ─────────────────────────────────────
    // PHOTOGRAPHY BOOKING FIELDS
    // populated when type === "photography"
    // ─────────────────────────────────────
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      default: null,
    },

    // snapshot of package details at time of booking
    // in case package is later modified or deleted
    packageSnapshot: {
      name: { type: String, default: "" },
      category: { type: String, default: "" },
      type: { type: String, default: "" },
      includes: { type: [String], default: [] },
      duration: {
        value: { type: Number, default: null },
        unit: { type: String, default: "hours" },
      },
    },

    // ─────────────────────────────────────
    // RENTAL BOOKING FIELDS
    // populated when type === "rental"
    // ─────────────────────────────────────
    camera: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Camera",
      default: null,
    },

    // snapshot of camera at time of booking
    cameraSnapshot: {
      name: { type: String, default: "" },
      brand: { type: String, default: "" },
      model: { type: String, default: "" },
      imageUrl: { type: String, default: "" },
      // daily rate at booking time — kept here (not just on the live
      // Camera doc) so late-fee math still works correctly even if the
      // camera's rates change later or the camera is removed.
      dailyRate: { type: Number, default: 0 },
    },

    rentalType: {
      type: String,
      enum: ["hourly", "daily", "weekend", null],
      default: null,
    },

    rentalQuantity: {
      type: Number,
      default: 1,
      min: 1,
    },

    // selected accessories for rental
    selectedAccessories: {
      type: [String],
      default: [],
    },

    // photographer add-on for rental
    withPhotographer: {
      type: Boolean,
      default: false,
    },

    // ─────────────────────────────────────
    // SESSION DETAILS
    // common for both types
    // ─────────────────────────────────────
    date: {
      type: Date,
      required: [true, "Booking date is required"],
    },

    // populated only for multi-day bookings (wedding packages booked
    // over a date range, or a camera rented for multiple days).
    // when set, this booking spans [date, endDate] inclusive.
    endDate: {
      type: Date,
      default: null,
    },

    // true when this booking spans a date range instead of a single day.
    // multi-day bookings never use a time slot — the vendor is expected
    // on-site/with the renter for the full span.
    isMultiDay: {
      type: Boolean,
      default: false,
    },

    // which Availability calendar this booking was checked/reserved
    // against — "wedding" for wedding/marriage packages (separate
    // dedicated photographers), "general" for everything else
    // (non-wedding photography sessions + camera rentals).
    availabilityScope: {
      type: String,
      enum: ["general", "wedding"],
      default: "general",
    },

    time: {
      type: String,
      required: [
        function () {
          return !this.isMultiDay;
        },
        "Booking time is required",
      ],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format"],
      default: undefined,
    },

    location: {
      type: String,
      trim: true,
      maxlength: [200, "Location cannot exceed 200 characters"],
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
      default: "",
    },

    // ─────────────────────────────────────
    // STATUS LIFECYCLE
    // Pending → Payment Done → Confirmed
    // → In Progress → Completed | Cancelled
    // ─────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: [
          "Pending",
          "Payment Done",
          "Confirmed",
          "In Progress",
          "Completed",
          "Cancelled",
        ],
        message: "Invalid booking status",
      },
      default: "Pending",
    },

    // history of all status changes — full audit trail
    statusHistory: {
      type: [
        {
          status: {
            type: String,
            enum: [
              "Pending",
              "Payment Done",
              "Confirmed",
              "In Progress",
              "Completed",
              "Cancelled",
            ],
          },
          changedAt: {
            type: Date,
            default: Date.now,
          },
          note: {
            type: String,
            default: "",
          },
        },
      ],
      default: [],
    },

    // ─────────────────────────────────────
    // AMOUNT BREAKDOWN
    // ─────────────────────────────────────
    amount: {
      subtotal: {
        type: Number,
        required: [true, "Subtotal is required"],
        min: 0,
      },
      accessoryCost: {
        type: Number,
        default: 0,
      },
      photographerCost: {
        type: Number,
        default: 0,
      },
      securityDeposit: {
        type: Number,
        default: 0,
      },
      // added on return if the item came back later than the planned
      // return date — see `updateBookingStatus` (status → "Completed")
      lateFee: {
        type: Number,
        default: 0,
        min: 0,
      },
      total: {
        type: Number,
        required: [true, "Total amount is required"],
        min: 0,
      },
      currency: {
        type: String,
        default: "INR",
      },
    },

    // ─────────────────────────────────────
    // PAYMENT DETAILS
    // ─────────────────────────────────────
    payment: {
      razorpayOrderId: {
        type: String,
        default: null,
      },
      razorpayPaymentId: {
        type: String,
        default: null,
      },
      razorpaySignature: {
        type: String,
        default: null,
        select: false, // never expose signature in API responses
      },
      paidAt: {
        type: Date,
        default: null,
      },
      method: {
        type: String,
        default: null, // e.g. "card", "upi", "netbanking"
      },
    },

    // ─────────────────────────────────────
    // REFUND DETAILS
    // ─────────────────────────────────────
    refund: {
      razorpayRefundId: {
        type: String,
        default: null,
      },
      amount: {
        type: Number,
        default: 0,
      },
      status: {
        type: String,
        enum: ["none", "initiated", "processed", "failed"],
        default: "none",
      },
      initiatedAt: {
        type: Date,
        default: null,
      },
      reason: {
        type: String,
        default: "",
      },
    },

    // ─────────────────────────────────────
    // RESCHEDULE HISTORY
    // max 1 reschedule within 24hrs — tracked here
    // ─────────────────────────────────────
    rescheduleHistory: {
      type: [
        {
          oldDate: { type: Date, required: true },
          oldTime: { type: String, required: true },
          newDate: { type: Date, required: true },
          newTime: { type: String, required: true },
          rescheduledAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    // flag — has user used their reschedule?
    hasRescheduled: {
      type: Boolean,
      default: false,
    },

    // ─────────────────────────────────────
    // CANCELLATION DETAILS
    // ─────────────────────────────────────
    cancellation: {
      cancelledAt: { type: Date, default: null },
      reason: { type: String, default: "" },
      cancelledBy: {
        type: String,
        enum: ["user", "admin", null],
        default: null,
      },
    },

    // reminder email sent flag — prevents duplicate sends
    reminderSent: {
      type: Boolean,
      default: false,
    },

    // set true once the user leaves a review for this booking —
    // enforces one review per booking (see Review.model.js) and lets
    // the UI hide the "Write a review" action once it's been used
    hasReview: {
      type: Boolean,
      default: false,
    },

    // ─────────────────────────────────────
    // HANDOVER TRACKING
    // when the camera/photographer was actually collected and
    // returned — separate from the *planned* date/endDate above.
    // Set by the admin "mark status" endpoint, not by the customer.
    // ─────────────────────────────────────
    handover: {
      pickedUpAt: { type: Date, default: null }, // set when status → "In Progress"
      returnedAt: { type: Date, default: null }, // set when status → "Completed"
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
bookingSchema.index({ user: 1, createdAt: -1 }); // user's bookings sorted newest first
bookingSchema.index({ status: 1 }); // filter by status
bookingSchema.index({ date: 1 }); // date-based queries + reminder cron
bookingSchema.index({ "payment.razorpayOrderId": 1 }); // payment verification lookup
bookingSchema.index({ type: 1, status: 1 }); // filter by type + status

// ─────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────

// human-readable booking reference — shown to user
bookingSchema.virtual("bookingRef").get(function () {
  return `BK-${this._id.toString().slice(-8).toUpperCase()}`;
});

// is booking cancellable — only Pending, Payment Done, Confirmed
bookingSchema.virtual("isCancellable").get(function () {
  return ["Pending", "Payment Done", "Confirmed"].includes(this.status);
});

// is booking reschedulable
// rules: confirmed, not yet rescheduled, shoot is more than 24hrs away
bookingSchema.virtual("isReschedulable").get(function () {
  if (this.isMultiDay) return false; // multi-day bookings need manual support to reschedule
  if (this.hasRescheduled) return false;
  if (!["Confirmed", "Payment Done"].includes(this.status)) return false;

  const hoursUntilShoot = (new Date(this.date) - new Date()) / (1000 * 60 * 60);
  return hoursUntilShoot > 24;
});

// number of days this booking spans (1 for single-day bookings)
bookingSchema.virtual("numberOfDays").get(function () {
  if (!this.isMultiDay || !this.endDate) return 1;
  const ms = new Date(this.endDate) - new Date(this.date);
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
});

// ─────────────────────────────────────────
// the date the item/event is *planned* to conclude by — i.e. the
// deadline "returnedAt" is measured against for overdue/late-fee
// purposes. Not the same as `date`/`endDate` alone, because a
// single-day rental can still book multiple units of the daily rate
// (rentalQuantity) without ever setting endDate/isMultiDay.
// ─────────────────────────────────────────
bookingSchema.virtual("plannedReturnDate").get(function () {
  if (this.isMultiDay && this.endDate) return new Date(this.endDate);

  if (this.type === "rental") {
    if (this.rentalType === "daily" && this.rentalQuantity > 1) {
      const d = new Date(this.date);
      d.setDate(d.getDate() + (this.rentalQuantity - 1));
      return d;
    }
    if (this.rentalType === "weekend") {
      // weekend rate = fixed ~2-day span (e.g. Sat pickup → Sun return)
      const d = new Date(this.date);
      d.setDate(d.getDate() + 1);
      return d;
    }
  }

  // hourly rentals and single-day photography sessions are expected
  // back the same day
  return new Date(this.date);
});

// true once the planned return date has fully passed (end of that
// day) and the booking hasn't been marked Completed/Cancelled yet —
// i.e. gear is out past its due date, or a shoot ran past its window.
bookingSchema.virtual("isOverdue").get(function () {
  if (["Completed", "Cancelled", "Pending"].includes(this.status)) return false;

  const deadline = new Date(this.plannedReturnDate);
  deadline.setHours(23, 59, 59, 999);

  return new Date() > deadline;
});

// whole days past the planned return date (0 if not overdue)
bookingSchema.virtual("overdueDays").get(function () {
  if (!this.isOverdue) return 0;

  const deadline = new Date(this.plannedReturnDate);
  deadline.setHours(23, 59, 59, 999);

  const ms = new Date() - deadline;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
});

// formatted total amount
bookingSchema.virtual("formattedTotal").get(function () {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(this.amount.total);
});

// ─────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────

/**
 * Update booking status and push to statusHistory
 * @param {string} newStatus
 * @param {string} note — optional note for audit trail
 */
bookingSchema.methods.updateStatus = async function (newStatus, note = "") {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    changedAt: new Date(),
    note,
  });
  return this.save();
};

/**
 * Check if booking qualifies for full refund
 * Business rule: shoot date must be 48+ hours away
 * @returns {{ eligible: boolean, hoursLeft: number }}
 */
bookingSchema.methods.checkRefundEligibility = function () {
  const hoursLeft = (new Date(this.date) - new Date()) / (1000 * 60 * 60);
  return {
    eligible: hoursLeft >= 48,
    hoursLeft: Math.round(hoursLeft),
  };
};

/**
 * Record the actual pickup or return of a rental/photography booking
 * and, on return, calculate and apply a late fee if the item/event
 * ran past its planned return date.
 * @param {"pickedUp"|"returned"} event
 * @param {{ waiveLateFee?: boolean }} [options]
 * @returns {{ lateFee: number, overdueDays: number }}
 */
bookingSchema.methods.recordHandover = function (event, options = {}) {
  const now = new Date();

  if (event === "pickedUp") {
    this.handover.pickedUpAt = now;
    return { lateFee: 0, overdueDays: 0 };
  }

  // event === "returned"
  const overdueDays = this.overdueDays; // uses plannedReturnDate as of "now"
  let lateFee = 0;

  if (
    !options.waiveLateFee &&
    this.type === "rental" &&
    overdueDays > 0 &&
    this.cameraSnapshot?.dailyRate > 0
  ) {
    lateFee = overdueDays * this.cameraSnapshot.dailyRate;
  }

  this.handover.returnedAt = now;
  this.amount.lateFee = lateFee;
  this.amount.total += lateFee;

  return { lateFee, overdueDays };
};

// ─────────────────────────────────────────
// PRE-SAVE HOOK
// push initial "Pending" status to history on creation
// ─────────────────────────────────────────
bookingSchema.pre("save", function (next) {
  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({
      status: "Pending",
      changedAt: new Date(),
      note: "Booking created",
    });
  }
  next();
});

// ─────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────

/**
 * Get bookings due for reminder tomorrow
 * Used by reminder scheduler/cron
 * @returns {Array} bookings with date tomorrow, reminder not yet sent
 */
bookingSchema.statics.getDueForReminder = function () {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
  const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999));

  return this.find({
    date: { $gte: startOfTomorrow, $lte: endOfTomorrow },
    status: { $in: ["Confirmed", "In Progress"] },
    reminderSent: false,
  }).populate("user", "name email");
};

/**
 * Get all bookings that are currently overdue — gear/photographer not
 * yet marked returned/completed past their planned return date.
 * Used by the admin "overdue" endpoint and can back a reminder cron.
 * Filters candidates in Mongo, then applies the exact `isOverdue`
 * virtual in memory since plannedReturnDate depends on multiple fields.
 * @returns {Array} overdue booking documents
 */
bookingSchema.statics.getOverdueBookings = async function () {
  const candidates = await this.find({
    status: { $in: ["Confirmed", "Payment Done", "In Progress"] },
  })
    .populate("user", "name email phone")
    .sort({ date: 1 });

  return candidates.filter((b) => b.isOverdue);
};

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
