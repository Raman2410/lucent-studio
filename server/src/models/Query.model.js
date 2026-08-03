"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────
// QUERY SCHEMA
// handles user queries from help center
// three channels:
//   1. AI chatbot response (instant)
//   2. Manual query form (email fallback)
//   3. Team follows up via email
// ─────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Query:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         user:
 *           type: string
 *           description: User ID reference
 *         subject:
 *           type: string
 *           example: "Question about wedding package"
 *         message:
 *           type: string
 *           example: "Does the premium package include drone shots?"
 *         status:
 *           type: string
 *           enum: [Open, In Review, Resolved, Closed]
 *           example: "Open"
 *         aiResponse:
 *           type: object
 *           properties:
 *             content:
 *               type: string
 *             answeredAt:
 *               type: string
 *               format: date-time
 *             wasHelpful:
 *               type: boolean
 */
const querySchema = new mongoose.Schema(
  {
    // ─────────────────────────────────────
    // CORE FIELDS
    // ─────────────────────────────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      minlength: [5, "Subject must be at least 5 characters"],
      maxlength: [150, "Subject cannot exceed 150 characters"],
    },

    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [10, "Message must be at least 10 characters"],
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },

    // optional link to a specific booking
    relatedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    // ─────────────────────────────────────
    // STATUS LIFECYCLE
    // Open → In Review → Resolved → Closed
    // ─────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ["Open", "In Review", "Resolved", "Closed"],
        message: "Invalid query status",
      },
      default: "Open",
    },

    // audit trail of status changes
    statusHistory: {
      type: [
        {
          status: {
            type: String,
            enum: ["Open", "In Review", "Resolved", "Closed"],
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
    // AI CHATBOT RESPONSE
    // Claude's instant response to the query
    // ─────────────────────────────────────
    aiResponse: {
      // the AI-generated response content
      content: {
        type: String,
        default: null,
      },

      // when the AI responded
      answeredAt: {
        type: Date,
        default: null,
      },

      // did user find the AI response helpful?
      // collected via thumbs up/down on frontend
      wasHelpful: {
        type: Boolean,
        default: null, // null = no feedback given yet
      },

      // did AI escalate to human team?
      escalated: {
        type: Boolean,
        default: false,
      },

      // tokens used — useful for cost monitoring
      tokensUsed: {
        type: Number,
        default: 0,
      },
    },

    // ─────────────────────────────────────
    // TEAM RESPONSE
    // manual reply from photography team
    // ─────────────────────────────────────
    teamResponse: {
      content: {
        type: String,
        default: null,
      },

      respondedAt: {
        type: Date,
        default: null,
      },

      // who on the team responded (for internal tracking)
      respondedBy: {
        type: String,
        default: null,
      },
    },

    // ─────────────────────────────────────
    // QUERY SOURCE
    // where did this query come from?
    // ─────────────────────────────────────
    source: {
      type: String,
      enum: {
        values: ["chatbot", "form", "both"],
        message: "Invalid source",
      },
      default: "form",
    },

    // category helps team prioritize and route queries
    category: {
      type: String,
      enum: {
        values: [
          "booking", // questions about existing bookings
          "packages", // package pricing, inclusions
          "rental", // camera rental questions
          "payment", // payment, refund issues
          "technical", // website technical issues
          "general", // general inquiries
          "other",
        ],
        message: "Invalid query category",
      },
      default: "general",
    },

    // priority — set by AI or team
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    // ─────────────────────────────────────
    // QUERY REFERENCE
    // human-readable ID shown in emails
    // ─────────────────────────────────────
    queryRef: {
      type: String,
      default: null, // set in pre-save hook; index below (sparse+unique) allows nulls during creation
    },

    // user has been notified about team response?
    notificationSent: {
      type: Boolean,
      default: false,
    },

    // resolved / closed metadata
    resolution: {
      resolvedAt: { type: Date, default: null },
      closedAt: { type: Date, default: null },
      resolvedBy: {
        type: String,
        enum: ["ai", "team", null],
        default: null,
      },
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
querySchema.index({ user: 1, createdAt: -1 }); // user's queries newest first
querySchema.index({ status: 1 }); // filter by status
querySchema.index({ priority: 1, status: 1 }); // high priority open queries
querySchema.index({ queryRef: 1 }, { unique: true, sparse: true }); // unique ref lookup
querySchema.index({ createdAt: -1 }); // admin views newest first

// ─────────────────────────────────────────
// PRE-SAVE HOOK — generate queryRef
// format: QR-YYYYMMDD-XXXX (e.g. QR-20240815-A3F2)
// ─────────────────────────────────────────
querySchema.pre("save", function (next) {
  // generate queryRef on creation
  if (this.isNew) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const randomStr = this._id.toString().slice(-4).toUpperCase();
    this.queryRef = `QR-${dateStr}-${randomStr}`;

    // push initial status to history
    this.statusHistory.push({
      status: "Open",
      changedAt: new Date(),
      note: "Query submitted",
    });
  }
  next();
});

// ─────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────

// has the query received any response (AI or team)?
querySchema.virtual("hasResponse").get(function () {
  return !!(this.aiResponse?.content || this.teamResponse?.content);
});

// is query still pending (no team response yet)?
querySchema.virtual("awaitingTeamResponse").get(function () {
  return (
    ["Open", "In Review"].includes(this.status) && !this.teamResponse?.content
  );
});

// time since query was submitted (in hours)
querySchema.virtual("ageInHours").get(function () {
  return Math.round((new Date() - this.createdAt) / (1000 * 60 * 60));
});

// ─────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────

/**
 * Update query status with audit trail
 * @param {string} newStatus
 * @param {string} note
 */
querySchema.methods.updateStatus = async function (newStatus, note = "") {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    changedAt: new Date(),
    note,
  });

  // set resolution timestamps
  if (newStatus === "Resolved") {
    this.resolution.resolvedAt = new Date();
  }
  if (newStatus === "Closed") {
    this.resolution.closedAt = new Date();
  }

  return this.save();
};

/**
 * Attach AI response to query
 * @param {string} content — AI response text
 * @param {number} tokensUsed
 * @param {boolean} escalated — did AI escalate to team?
 */
querySchema.methods.attachAiResponse = async function (
  content,
  tokensUsed = 0,
  escalated = false,
) {
  this.aiResponse.content = content;
  this.aiResponse.answeredAt = new Date();
  this.aiResponse.tokensUsed = tokensUsed;
  this.aiResponse.escalated = escalated;
  this.source = this.source === "form" ? "both" : "chatbot";

  // if AI handled it without escalation — mark as resolved
  if (!escalated) {
    await this.updateStatus("Resolved", "Resolved by AI chatbot");
    this.resolution.resolvedBy = "ai";
  } else {
    await this.updateStatus("In Review", "Escalated to team by AI");
  }

  return this.save();
};

// ─────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────

/**
 * Get open high-priority queries for team dashboard
 * @returns {Array} urgent + high priority open queries
 */
querySchema.statics.getUrgentQueries = function () {
  return this.find({
    status: { $in: ["Open", "In Review"] },
    priority: { $in: ["urgent", "high"] },
  })
    .populate("user", "name email phone")
    .populate("relatedBooking", "bookingRef date status")
    .sort({ priority: -1, createdAt: 1 }) // urgent first, then oldest
    .limit(20);
};

/**
 * Get queries awaiting team response (AI escalated or no AI response)
 * @returns {Array}
 */
querySchema.statics.getPendingTeamResponse = function () {
  return this.find({
    status: { $in: ["Open", "In Review"] },
    "teamResponse.content": null,
  })
    .populate("user", "name email")
    .sort({ createdAt: 1 }); // oldest first — FIFO
};

const Query = mongoose.model("Query", querySchema);

module.exports = Query;
