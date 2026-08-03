"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// ─────────────────────────────────────────
// USER SCHEMA
// ─────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         name:
 *           type: string
 *           example: "Rahul Sharma"
 *         email:
 *           type: string
 *           example: "rahul@example.com"
 *         phone:
 *           type: string
 *           example: "9876543210"
 *         createdAt:
 *           type: string
 *           format: date-time
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [
        /^[6-9]\d{9}$/,
        "Please provide a valid 10-digit Indian mobile number",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // never returned in queries by default
    },

    // ─────────────────────────────────────
    // ROLE — gates access to /api/admin/*
    // set to "admin" manually in the DB for
    // the photographer/business owner account
    // ─────────────────────────────────────
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    passwordChangedAt: {
      type: Date,
      select: false,
    },

    // ─────────────────────────────────────
    // TOKEN VERSION — deterministic auth invalidation
    // JWT `iat` only has whole-second resolution, so comparing it
    // against passwordChangedAt can't reliably tell "old token" from
    // "brand new token" when both happen within the same second (e.g.
    // register→change-password in a fast test, or a quick double
    // action in real usage). An incrementing integer sidesteps that
    // entirely: every password change bumps this, the new token is
    // signed with the new value, and any token signed with an older
    // value is rejected — no clock comparison involved.
    // ─────────────────────────────────────
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },

    // ─────────────────────────────────────
    // PASSWORD RESET — forgot password flow
    // token itself is never stored — only its
    // sha256 hash, so a leaked DB can't be used
    // to reset accounts (same principle as password)
    // ─────────────────────────────────────
    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // ─────────────────────────────────────
    // EMAIL VERIFICATION
    // set true once the user clicks the link emailed at registration.
    // Verification is NOT required to log in or use the site (keeps
    // the "lazy auth" philosophy — no extra friction) but the frontend
    // surfaces a gentle nudge banner while it's false, and it's the
    // signal other features (e.g. leaving a review) can key off of.
    // Same hash-only-on-token pattern as password reset above.
    // ─────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    // soft delete — user account deactivated but data retained
    isActive: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────
// email index already created by `unique: true` on the schema field above —
// no need to declare it again with userSchema.index({ email: 1 })
userSchema.index({ createdAt: -1 }); // sort by newest first

// ─────────────────────────────────────────
// VIRTUAL — bookings count
// populated when needed — not stored in DB
// ─────────────────────────────────────────
userSchema.virtual("bookings", {
  ref: "Booking",
  localField: "_id",
  foreignField: "user",
});

// ─────────────────────────────────────────
// PRE-SAVE HOOK — hash password
// only runs if password field was modified
// ─────────────────────────────────────────
userSchema.pre("save", async function (next) {
  // skip if password not modified
  if (!this.isModified("password")) return next();

  // hash with cost factor 12 — good balance of security vs speed
  this.password = await bcrypt.hash(this.password, 12);

  next();
});

// ─────────────────────────────────────────
// PRE-SAVE HOOK — set passwordChangedAt
// when password is changed (not on creation)
// ─────────────────────────────────────────
userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();

  // kept for display/audit purposes — no longer used to invalidate
  // tokens (see tokenVersion above for why)
  this.passwordChangedAt = Date.now();

  // this is the actual invalidation mechanism — any token signed
  // with the previous tokenVersion is now rejected by protect()
  this.tokenVersion = (this.tokenVersion || 0) + 1;

  next();
});

// ─────────────────────────────────────────
// PRE-QUERY HOOK — filter inactive users
// transparently excludes deactivated accounts
// from all find queries
// ─────────────────────────────────────────
userSchema.pre(/^find/, function (next) {
  this.find({ isActive: { $ne: false } });
  next();
});

// ─────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────

/**
 * Compare candidate password with stored hashed password
 * @param {string} candidatePassword — plain text from login form
 * @returns {boolean} true if match
 */
userSchema.methods.correctPassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Check if password was changed after JWT was issued
 * Used in auth middleware to invalidate old tokens
 * @param {number} JWTTimestamp — iat from decoded JWT (seconds)
 * @returns {boolean} true if password changed after token was issued
 */
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    // convert passwordChangedAt to seconds (same unit as JWT iat)
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    // if password changed AFTER token issued → token is invalid
    return JWTTimestamp < changedTimestamp;
  }
  // password never changed — token is valid
  return false;
};

/**
 * Check if user account is active
 * @returns {boolean}
 */
userSchema.methods.isAccountActive = function () {
  return this.isActive;
};

/**
 * Generate a password reset token
 * Returns the PLAIN token (sent to user via email) while storing
 * only its sha256 HASH on the document — mirrors how the password
 * itself is never stored in plain text.
 * Caller is responsible for calling user.save() afterwards.
 * @returns {string} plain reset token (unhashed, goes in the email link)
 */
userSchema.methods.createPasswordResetToken = function () {
  // random, unguessable token — sent to the user, never persisted as-is
  const resetToken = crypto.randomBytes(32).toString("hex");

  // store only the hash — same defense-in-depth as bcrypt password hashing
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // token expires in 15 minutes
  this.passwordResetExpires = Date.now() + 15 * 60 * 1000;

  return resetToken;
};

/**
 * Generate an email verification token.
 * Returns the PLAIN token (sent to user via email) while storing only
 * its sha256 HASH on the document — same pattern as password reset.
 * Caller is responsible for calling user.save() afterwards.
 * @returns {string} plain verification token (unhashed, goes in the email link)
 */
userSchema.methods.createEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  // token expires in 24 hours — longer window than password reset since
  // there's no security-sensitive action gated behind it, just annoyance
  // if it expires before the user gets around to clicking it
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  return verificationToken;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
