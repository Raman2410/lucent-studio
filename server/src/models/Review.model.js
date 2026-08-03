"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────
// REVIEW SCHEMA
// A review is always tied to a completed booking — this is what
// guarantees it's from a real customer, not an anonymous drive-by.
// One review per booking (enforced by a unique index below + the
// Booking.hasReview flag checked in the controller).
// ─────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         user:
 *           type: string
 *           description: User ID reference
 *         booking:
 *           type: string
 *           description: Booking ID this review is tied to
 *         targetType:
 *           type: string
 *           enum: [package, camera]
 *         rating:
 *           type: number
 *           example: 5
 *         comment:
 *           type: string
 *           example: "Fantastic experience, the photos turned out beautifully!"
 */
const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    // ties the review to the specific booking that earned it —
    // also lets the UI show "booked on <date>" next to the review
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: [true, "Booking reference is required"],
      unique: true, // one review per booking, enforced at the DB level too
    },

    // which kind of thing this review is about — determines whether
    // `package` or `camera` below is populated
    targetType: {
      type: String,
      required: true,
      enum: {
        values: ["package", "camera"],
        message: "targetType must be package or camera",
      },
    },

    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      default: null,
    },

    camera: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Camera",
      default: null,
    },

    // snapshot fields — survive the user changing their name later,
    // and avoid a populate() on every review list render
    userSnapshot: {
      name: { type: String, default: "" },
    },

    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },

    comment: {
      type: String,
      trim: true,
      maxlength: [1000, "Review comment cannot exceed 1000 characters"],
      default: "",
    },

    // set true if an admin removes a review for violating guidelines —
    // soft-hidden rather than hard-deleted, so the rating recalculation
    // hooks below have a consistent trigger (save/remove) either way
    isHidden: {
      type: Boolean,
      default: false,
      select: false,
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
reviewSchema.index({ package: 1, createdAt: -1 });
reviewSchema.index({ camera: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });

// ─────────────────────────────────────────
// PRE-QUERY HOOK — hide soft-removed reviews
// ─────────────────────────────────────────
reviewSchema.pre(/^find/, function (next) {
  this.find({ isHidden: { $ne: true } });
  next();
});

// ─────────────────────────────────────────
// STATIC — recalculate ratingsAverage/ratingsCount
// Runs after every save/remove so Package/Camera documents always
// reflect the current set of (non-hidden) reviews without a live
// aggregation on every listing page request.
// ─────────────────────────────────────────
reviewSchema.statics.recalculateRatings = async function (
  targetType,
  targetId,
) {
  if (!targetId) return;

  const Model =
    targetType === "package"
      ? require("./Package.model")
      : require("./Camera.model");

  const stats = await this.aggregate([
    {
      $match: {
        [targetType]: targetId,
        isHidden: { $ne: true },
      },
    },
    {
      $group: {
        _id: `$${targetType}`,
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Model.findByIdAndUpdate(targetId, {
      ratingsAverage: stats[0].avgRating,
      ratingsCount: stats[0].count,
    });
  } else {
    // no reviews left — reset to zero
    await Model.findByIdAndUpdate(targetId, {
      ratingsAverage: 0,
      ratingsCount: 0,
    });
  }
};

// ─────────────────────────────────────────
// HOOKS — keep denormalized ratings in sync
// ─────────────────────────────────────────
reviewSchema.post("save", async function (doc) {
  await doc.constructor.recalculateRatings(
    doc.targetType,
    doc.targetType === "package" ? doc.package : doc.camera,
  );
});

// findOneAndUpdate is used when an admin hides a review — recalc after
reviewSchema.post("findOneAndUpdate", async function (doc) {
  if (doc) {
    await doc.constructor.recalculateRatings(
      doc.targetType,
      doc.targetType === "package" ? doc.package : doc.camera,
    );
  }
});

reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await doc.constructor.recalculateRatings(
      doc.targetType,
      doc.targetType === "package" ? doc.package : doc.camera,
    );
  }
});

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
