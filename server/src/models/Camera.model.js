"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────
// CAMERA SCHEMA
// ─────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Camera:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         name:
 *           type: string
 *           example: "Sony Alpha A7 III"
 *         brand:
 *           type: string
 *           example: "Sony"
 *         model:
 *           type: string
 *           example: "A7 III"
 *         image:
 *           type: object
 *           properties:
 *             url:
 *               type: string
 *             s3Key:
 *               type: string
 *         rentalRates:
 *           type: object
 *           properties:
 *             hourly:
 *               type: number
 *               example: 500
 *             daily:
 *               type: number
 *               example: 3000
 *             weekend:
 *               type: number
 *               example: 5000
 *         isAvailable:
 *           type: boolean
 *           example: true
 */
const cameraSchema = new mongoose.Schema(
  {
    // ─────────────────────────────────────
    // BASIC INFO
    // ─────────────────────────────────────
    name: {
      type: String,
      required: [true, "Camera name is required"],
      trim: true,
      maxlength: [150, "Camera name cannot exceed 150 characters"],
    },

    brand: {
      type: String,
      required: [true, "Brand is required"],
      trim: true,
      maxlength: [50, "Brand cannot exceed 50 characters"],
    },

    model: {
      type: String,
      required: [true, "Model is required"],
      trim: true,
      maxlength: [100, "Model cannot exceed 100 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: "",
    },

    // ─────────────────────────────────────
    // CAMERA IMAGE
    // ─────────────────────────────────────
    image: {
      url: {
        type: String,
        required: [true, "Camera image URL is required"],
        trim: true,
      },
      s3Key: {
        type: String,
        required: [true, "Camera image S3 key is required"],
        trim: true,
      },
    },

    // ─────────────────────────────────────
    // TECHNICAL SPECIFICATIONS
    // shown in camera detail page
    // ─────────────────────────────────────
    specs: {
      sensorType: {
        type: String,
        trim: true,
        default: "", // e.g. "Full Frame", "APS-C", "Micro 4/3"
      },
      megapixels: {
        type: Number,
        default: null,
      },
      videoResolution: {
        type: String,
        trim: true,
        default: "", // e.g. "4K 30fps", "1080p 120fps"
      },
      isoRange: {
        type: String,
        trim: true,
        default: "", // e.g. "100-51200"
      },
      autofocusPoints: {
        type: Number,
        default: null,
      },
      batteryLife: {
        type: String,
        trim: true,
        default: "", // e.g. "~610 shots per charge"
      },
      bodyType: {
        type: String,
        enum: ["DSLR", "Mirrorless", "Point & Shoot", "Medium Format", "Film"],
        default: "Mirrorless",
      },
      mountType: {
        type: String,
        trim: true,
        default: "", // e.g. "Sony E-Mount", "Canon RF", "Nikon Z"
      },
    },

    // ─────────────────────────────────────
    // RENTAL RATES (in INR)
    // ─────────────────────────────────────
    rentalRates: {
      hourly: {
        type: Number,
        required: [true, "Hourly rental rate is required"],
        min: [0, "Rental rate cannot be negative"],
      },
      daily: {
        type: Number,
        required: [true, "Daily rental rate is required"],
        min: [0, "Rental rate cannot be negative"],
      },
      weekend: {
        type: Number,
        required: [true, "Weekend rental rate is required"],
        min: [0, "Rental rate cannot be negative"],
      },
    },

    // ─────────────────────────────────────
    // ACCESSORIES
    // bundled items available with camera
    // each accessory has its own image
    // ─────────────────────────────────────
    accessories: {
      type: [
        {
          name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
          },
          description: {
            type: String,
            trim: true,
            default: "",
          },
          image: {
            url: { type: String, trim: true, default: "" },
            s3Key: { type: String, trim: true, default: "" },
          },
          // additional charge for this accessory (0 = included free)
          additionalCharge: {
            type: Number,
            default: 0,
            min: 0,
          },
          isAvailable: {
            type: Boolean,
            default: true,
          },
        },
      ],
      default: [],
    },

    // ─────────────────────────────────────
    // PHOTOGRAPHER ADD-ON
    // user can rent camera + book a photographer
    // ─────────────────────────────────────
    photographerAddon: {
      available: {
        type: Boolean,
        default: true,
      },
      // additional charge per hour for photographer
      chargePerHour: {
        type: Number,
        default: 500,
        min: 0,
      },
    },

    // ─────────────────────────────────────
    // AVAILABILITY
    // global flag — false = camera under maintenance
    // date-level availability handled by Availability model
    // ─────────────────────────────────────
    isAvailable: {
      type: Boolean,
      default: true,
    },

    // reason shown to users when unavailable
    unavailabilityReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },

    // ─────────────────────────────────────
    // RENTAL TERMS & CONDITIONS
    // ─────────────────────────────────────
    rentalTerms: {
      // security deposit in INR (refunded after return)
      securityDeposit: {
        type: Number,
        default: 5000,
        min: 0,
      },
      // ID proof required for rental
      idProofRequired: {
        type: Boolean,
        default: true,
      },
      // additional notes for renter
      notes: {
        type: String,
        trim: true,
        default:
          "Camera must be returned in the same condition. Any damage will be deducted from security deposit.",
        maxlength: 500,
      },
    },

    // display order — lower = shown first
    displayOrder: {
      type: Number,
      default: 0,
    },

    // ─────────────────────────────────────
    // RATINGS — denormalized cache, kept in sync by
    // Review.model.js's post-save/post-remove hooks — see Package.model.js
    // for the identical pattern.
    // ─────────────────────────────────────
    ratingsAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      set: (val) => Math.round(val * 10) / 10,
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
cameraSchema.index({ brand: 1 }); // filter by brand
cameraSchema.index({ isAvailable: 1 }); // available cameras
cameraSchema.index({ displayOrder: 1 }); // sorted listing
cameraSchema.index({ "specs.bodyType": 1 }); // filter by body type

// ─────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────

// full display name — "Sony Alpha A7 III"
cameraSchema.virtual("fullName").get(function () {
  return `${this.brand} ${this.name}`;
});

// formatted rental rates
cameraSchema.virtual("formattedRates").get(function () {
  const format = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  return {
    hourly: `${format(this.rentalRates.hourly)}/hr`,
    daily: `${format(this.rentalRates.daily)}/day`,
    weekend: `${format(this.rentalRates.weekend)}/weekend`,
  };
});

// total accessories count
cameraSchema.virtual("accessoryCount").get(function () {
  return this.accessories.filter((a) => a.isAvailable).length;
});

// ─────────────────────────────────────────
// PRE-QUERY HOOK — filter inactive cameras
// ─────────────────────────────────────────
cameraSchema.pre(/^find/, function (next) {
  this.find({ isActive: { $ne: false } });
  next();
});

// ─────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────

/**
 * Calculate total rental cost for a booking
 * @param {string} rentalType — "hourly" | "daily" | "weekend"
 * @param {number} quantity   — hours or days
 * @param {Array}  accessories — selected accessory names
 * @param {boolean} withPhotographer
 * @returns {object} { baseCost, accessoryCost, photographerCost, total }
 */
cameraSchema.methods.calculateRentalCost = function (
  rentalType,
  quantity = 1,
  accessories = [],
  withPhotographer = false,
) {
  // base rental cost
  const baseCost = this.rentalRates[rentalType] * quantity;

  // accessories cost
  const accessoryCost = accessories.reduce((total, selectedName) => {
    const acc = this.accessories.find(
      (a) => a.name === selectedName && a.isAvailable,
    );
    return total + (acc ? acc.additionalCharge : 0);
  }, 0);

  // photographer add-on cost
  const photographerCost =
    withPhotographer && this.photographerAddon.available
      ? this.photographerAddon.chargePerHour *
        (rentalType === "hourly" ? quantity : quantity * 8)
      : 0;

  const subtotal = baseCost + accessoryCost + photographerCost;

  return {
    baseCost,
    accessoryCost,
    photographerCost,
    securityDeposit: this.rentalTerms.securityDeposit,
    subtotal,
    total: subtotal + this.rentalTerms.securityDeposit,
  };
};

const Camera = mongoose.model("Camera", cameraSchema);

module.exports = Camera;
