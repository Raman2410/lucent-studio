"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────
// PACKAGE SCHEMA
// ─────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Package:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         name:
 *           type: string
 *           example: "Premium Wedding Package"
 *         category:
 *           type: string
 *           enum: [wedding, portrait, commercial, nature, street]
 *         type:
 *           type: string
 *           enum: [fixed, custom, hourly]
 *         price:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *               example: 25000
 *             currency:
 *               type: string
 *               example: "INR"
 *             unit:
 *               type: string
 *               example: "per session"
 *         includes:
 *           type: array
 *           items:
 *             type: string
 *           example: ["8 hours coverage", "500 edited photos", "Online gallery"]
 *         isPopular:
 *           type: boolean
 *           example: true
 */
const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Package name is required"],
      trim: true,
      maxlength: [150, "Package name cannot exceed 150 characters"],
    },

    // short tagline shown on package card
    tagline: {
      type: String,
      trim: true,
      maxlength: [200, "Tagline cannot exceed 200 characters"],
      default: "",
    },

    // photography category this package belongs to
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: ["wedding", "portrait", "commercial", "nature", "street"],
        message: "Invalid category",
      },
      lowercase: true,
    },

    // package pricing type
    type: {
      type: String,
      required: [true, "Package type is required"],
      enum: {
        values: ["fixed", "custom", "hourly"],
        message: "Type must be one of: fixed, custom, hourly",
      },
    },

    // pricing details
    price: {
      // base amount in INR
      // for "custom" type — this is the starting price
      // for "hourly" — this is the per-hour rate
      amount: {
        type: Number,
        required: [true, "Price amount is required"],
        min: [0, "Price cannot be negative"],
      },

      currency: {
        type: String,
        default: "INR",
        uppercase: true,
      },

      // human-readable price label shown to user
      // e.g. "per session", "per hour", "starting from"
      unit: {
        type: String,
        default: "per session",
        trim: true,
        maxlength: [50, "Price unit cannot exceed 50 characters"],
      },
    },

    // full description of the package
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    // what's included — shown as bullet points on UI
    includes: {
      type: [String],
      required: [true, "Package inclusions are required"],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one inclusion is required",
      },
    },

    // what's NOT included — manages expectations
    excludes: {
      type: [String],
      default: [],
    },

    // duration of the session
    duration: {
      value: {
        type: Number,
        default: null, // null for custom packages
      },
      unit: {
        type: String,
        enum: ["hours", "days", "sessions"],
        default: "hours",
      },
    },

    // deliverables — number of edited photos, videos etc.
    deliverables: {
      editedPhotos: {
        type: Number,
        default: null,
      },
      videos: {
        type: Number,
        default: 0,
      },
      onlineGallery: {
        type: Boolean,
        default: true,
      },
      printableFiles: {
        type: Boolean,
        default: false,
      },
      turnaroundDays: {
        type: Number,
        default: 14, // delivery in 14 days by default
      },
    },

    // highlighted on UI — "Most Popular" badge
    isPopular: {
      type: Boolean,
      default: false,
    },

    // display order — lower = shown first
    displayOrder: {
      type: Number,
      default: 0,
    },

    // ─────────────────────────────────────
    // RATINGS — denormalized cache, kept in sync by
    // Review.model.js's post-save/post-remove hooks so listing pages
    // never need a separate aggregation query per package.
    // ─────────────────────────────────────
    ratingsAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      set: (val) => Math.round(val * 10) / 10, // one decimal place
    },

    ratingsCount: {
      type: Number,
      default: 0,
    },

    // soft delete
    isActive: {
      type: Boolean,
      default: true,
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
packageSchema.index({ category: 1, type: 1 }); // filter by category + type
packageSchema.index({ isPopular: 1 }); // fetch popular packages fast
packageSchema.index({ displayOrder: 1 }); // sorted listing

// ─────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────

// formatted price string — e.g. "₹25,000 per session"
packageSchema.virtual("formattedPrice").get(function () {
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(this.price.amount);
  return `${formatted} ${this.price.unit}`;
});

// ─────────────────────────────────────────
// PRE-QUERY HOOK — filter inactive packages
// ─────────────────────────────────────────
packageSchema.pre(/^find/, function (next) {
  this.find({ isActive: { $ne: false } });
  next();
});

// ─────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────

/**
 * Get packages grouped by category
 * Used for the packages listing page
 * @returns {Array} packages grouped by category
 */
packageSchema.statics.getGroupedByCategory = async function () {
  return this.aggregate([
    { $match: { isActive: { $ne: false } } },
    { $sort: { displayOrder: 1 } },
    {
      $group: {
        _id: "$category",
        packages: {
          $push: {
            _id: "$_id",
            name: "$name",
            tagline: "$tagline",
            type: "$type",
            price: "$price",
            includes: "$includes",
            duration: "$duration",
            deliverables: "$deliverables",
            isPopular: "$isPopular",
            displayOrder: "$displayOrder",
            ratingsAverage: "$ratingsAverage",
            ratingsCount: "$ratingsCount",
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

/**
 * Get popular packages across all categories
 * Shown on homepage
 * @param {number} limit
 * @returns {Array} popular packages
 */
packageSchema.statics.getPopular = function (limit = 6) {
  return this.find({ isPopular: true })
    .sort({ displayOrder: 1 })
    .limit(limit)
    .select("name tagline category type price includes duration isPopular ratingsAverage ratingsCount");
};

const Package = mongoose.model("Package", packageSchema);

module.exports = Package;
