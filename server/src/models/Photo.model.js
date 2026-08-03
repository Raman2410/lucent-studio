"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────
// PHOTO SCHEMA
// ─────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Photo:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         url:
 *           type: string
 *           example: "https://bucket.s3.ap-south-1.amazonaws.com/portfolio/123-abc.jpg"
 *         s3Key:
 *           type: string
 *           example: "portfolio/1720000000000-a3f2b1c4.jpg"
 *         category:
 *           type: string
 *           enum: [wedding, portrait, commercial, nature, street]
 *           example: "wedding"
 *         title:
 *           type: string
 *           example: "Golden Hour Wedding"
 *         description:
 *           type: string
 *           example: "Beautiful sunset wedding at Udaipur"
 *         isFeatured:
 *           type: boolean
 *           example: true
 *         displayOrder:
 *           type: number
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 */
const photoSchema = new mongoose.Schema(
  {
    // S3 public URL — served directly to frontend
    url: {
      type: String,
      required: [true, "Photo URL is required"],
      trim: true,
    },

    // S3 object key — needed for deletion
    // e.g. "portfolio/1720000000000-a3f2b1c4.jpg"
    s3Key: {
      type: String,
      required: [true, "S3 key is required"],
      trim: true,
    },

    // photography niche / category
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: {
        values: ["wedding", "portrait", "commercial", "nature", "street"],
        message:
          "Category must be one of: wedding, portrait, commercial, nature, street",
      },
      lowercase: true,
    },

    // optional display title
    title: {
      type: String,
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
      default: "",
    },

    // optional description / caption
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },

    // featured photos appear in hero section and scattered across homepage
    isFeatured: {
      type: Boolean,
      default: false,
    },

    // fine-grained subject labels, orthogonal to `category`.
    // category is a broad bucket (nature, portrait, ...); tags let
    // us distinguish subjects *within* a bucket — e.g. a "nature"
    // photo can be tagged "mountain", "river", or "bird" so the
    // homepage slideshow (or any future filter) can pull an exact
    // subject instead of a random photo from the whole category.
    tags: {
      type: [String],
      default: [],
      set: (arr) => (Array.isArray(arr) ? arr.map((t) => t.toLowerCase().trim()) : arr),
    },

    // controls display order within a category or featured section
    // lower number = displayed first
    displayOrder: {
      type: Number,
      default: 0,
    },

    // image dimensions — stored for frontend layout optimization
    // (aspect ratio, lazy loading placeholders)
    dimensions: {
      width: {
        type: Number,
        default: null,
      },
      height: {
        type: Number,
        default: null,
      },
    },

    // original file metadata — useful for admin reference
    originalName: {
      type: String,
      trim: true,
      default: "",
    },

    fileSizeBytes: {
      type: Number,
      default: null,
    },

    mimeType: {
      type: String,
      enum: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      default: "image/jpeg",
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
photoSchema.index({ category: 1, displayOrder: 1 }); // fetch by category sorted by order
photoSchema.index({ isFeatured: 1 }); // fast fetch of featured photos
photoSchema.index({ createdAt: -1 }); // latest photos first
photoSchema.index({ tags: 1 }); // fast lookup by subject tag (mountain, river, bird, ...)

// ─────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────

// aspect ratio — useful for frontend masonry/grid layouts
photoSchema.virtual("aspectRatio").get(function () {
  if (this.dimensions.width && this.dimensions.height) {
    return (this.dimensions.width / this.dimensions.height).toFixed(2);
  }
  return null;
});

// ─────────────────────────────────────────
// PRE-QUERY HOOK — filter inactive photos
// ─────────────────────────────────────────
photoSchema.pre(/^find/, function (next) {
  this.find({ isActive: { $ne: false } });
  next();
});

// ─────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────

/**
 * Get featured photos for homepage hero & scattered sections
 * @param {number} limit — number of featured photos to return
 * @returns {Array} featured photos sorted by displayOrder
 */
photoSchema.statics.getFeatured = function (limit = 10) {
  return this.find({ isFeatured: true })
    .sort({ displayOrder: 1, createdAt: -1 })
    .limit(limit)
    .select("url category title displayOrder dimensions tags");
};

/**
 * Get photos by category with pagination
 * @param {string} category
 * @param {number} page
 * @param {number} limit
 * @returns {object} { photos, total }
 */
photoSchema.statics.getByCategory = async function (
  category,
  page = 1,
  limit = 12,
) {
  const skip = (page - 1) * limit;

  const [photos, total] = await Promise.all([
    this.find({ category })
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "url category title description displayOrder dimensions isFeatured",
      ),
    this.countDocuments({ category }),
  ]);

  return { photos, total };
};

const Photo = mongoose.model("Photo", photoSchema);

module.exports = Photo;