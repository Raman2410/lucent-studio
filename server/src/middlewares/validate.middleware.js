"use strict";

const Joi = require("joi");
const { AppError } = require("./error.middleware");
const { STATUS } = require("../utils/apiResponse");

// ─────────────────────────────────────────
// CORE VALIDATOR FUNCTION
// wraps Joi validation — passes error to
// global error handler if validation fails
// ─────────────────────────────────────────

/**
 * Validate req.body, req.params or req.query against a Joi schema
 * @param {object} schema — Joi schema object
 * @param {string} source — "body" | "params" | "query" (default: "body")
 */
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false, // collect ALL errors, not just first
      stripUnknown: true, // remove unknown fields silently
      convert: true, // auto-convert types e.g. "5" → 5
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join(". ");
      return next(new AppError(messages, STATUS.BAD_REQUEST));
    }

    // replace req[source] with sanitized & converted value
    req[source] = value;
    next();
  };
};

// ─────────────────────────────────────────
// REUSABLE FIELD DEFINITIONS
// ─────────────────────────────────────────
const fields = {
  mongoId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .message("Invalid ID format"),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .trim()
    .max(100),

  password: Joi.string()
    .min(8)
    .max(64)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .message(
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
    ),

  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .message("Enter a valid 10-digit Indian mobile number"),

  name: Joi.string().trim().min(2).max(100),

  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
  },

  futureDate: Joi.date().greater("now").message("Date must be in the future"),

  category: Joi.string().valid(
    "wedding",
    "portrait",
    "commercial",
    "nature",
    "street",
  ),
};

// ─────────────────────────────────────────
// AUTH SCHEMAS
// ─────────────────────────────────────────
const authSchemas = {
  register: Joi.object({
    name: fields.name.required(),
    email: fields.email.required(),
    password: fields.password.required(),
    phone: fields.phone.required(),
  }),

  login: Joi.object({
    email: fields.email.required(),
    password: Joi.string().required(), // no complexity check on login
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: fields.password.required(),
    confirmPassword: Joi.any()
      .valid(Joi.ref("newPassword"))
      .required()
      .messages({ "any.only": "Passwords do not match" }),
  }),

  forgotPassword: Joi.object({
    email: fields.email.required(),
  }),

  resetPasswordParams: Joi.object({
    token: Joi.string().trim().hex().length(64).required().messages({
      "string.hex": "Invalid or malformed reset link",
      "string.length": "Invalid or malformed reset link",
    }),
  }),

  verifyEmailParams: Joi.object({
    token: Joi.string().trim().hex().length(64).required().messages({
      "string.hex": "Invalid or malformed verification link",
      "string.length": "Invalid or malformed verification link",
    }),
  }),

  resetPassword: Joi.object({
    newPassword: fields.password.required(),
    confirmPassword: Joi.any()
      .valid(Joi.ref("newPassword"))
      .required()
      .messages({ "any.only": "Passwords do not match" }),
  }),
};

// ─────────────────────────────────────────
// PHOTO SCHEMAS
// ─────────────────────────────────────────
const photoSchemas = {
  getByCategory: Joi.object({
    category: fields.category.required(),
  }),

  query: Joi.object({
    ...fields.pagination,
    category: fields.category,
    featured: Joi.boolean(),
    tag: Joi.string().trim().lowercase().max(50), // filter by subject tag, e.g. "mountain"
  }),
};

// ─────────────────────────────────────────
// PACKAGE SCHEMAS
// ─────────────────────────────────────────
const packageSchemas = {
  query: Joi.object({
    ...fields.pagination,
    category: fields.category,
    type: Joi.string().valid("fixed", "custom", "hourly"),
  }),

  getById: Joi.object({
    id: fields.mongoId.required(),
  }),
};

// ─────────────────────────────────────────
// CAMERA SCHEMAS
// ─────────────────────────────────────────
const cameraSchemas = {
  query: Joi.object({
    ...fields.pagination,
    rentalType: Joi.string().valid("hourly", "daily", "weekend"),
  }),

  getById: Joi.object({
    id: fields.mongoId.required(),
  }),
};

// ─────────────────────────────────────────
// BOOKING SCHEMAS
// ─────────────────────────────────────────
const bookingSchemas = {
  create: Joi.object({
    type: Joi.string().valid("photography", "rental").required(),

    // for photography bookings
    packageId: Joi.when("type", {
      is: "photography",
      then: fields.mongoId.required(),
      otherwise: Joi.forbidden(),
    }),

    // for rental bookings
    cameraId: Joi.when("type", {
      is: "rental",
      then: fields.mongoId.required(),
      otherwise: Joi.forbidden(),
    }),

    rentalType: Joi.when("type", {
      is: "rental",
      then: Joi.string().valid("hourly", "daily", "weekend").required(),
      otherwise: Joi.forbidden(),
    }),

    rentalQuantity: Joi.when("type", {
      is: "rental",
      then: Joi.number().integer().min(1).max(60).default(1),
      otherwise: Joi.forbidden(),
    }),

    // optional add-ons for rental
    withPhotographer: Joi.when("type", {
      is: "rental",
      then: Joi.boolean().default(false),
      otherwise: Joi.forbidden(),
    }),

    accessories: Joi.when("type", {
      is: "rental",
      then: Joi.array().items(Joi.string().trim()).default([]),
      otherwise: Joi.forbidden(),
    }),

    date: fields.futureDate.required(),

    // present only for multi-day bookings (wedding packages booked
    // over a date range, or a camera rented for multiple days)
    endDate: Joi.date().min(Joi.ref("date")).messages({
      "date.min": "End date cannot be before the start date",
    }),

    // time slots don't apply to multi-day bookings — the vendor/renter
    // is expected to be present/have the item for the entire span
    time: Joi.when("endDate", {
      is: Joi.exist(),
      then: Joi.forbidden(),
      otherwise: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .message("Time must be in HH:MM format (24hr)")
        .required(),
    }),

    location: Joi.string().trim().max(200),
    notes: Joi.string().trim().max(500),
  }),

  reschedule: Joi.object({
    newDate: fields.futureDate.required(),
    newTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .message("Time must be in HH:MM format (24hr)")
      .required(),
  }),

  idParam: Joi.object({
    id: fields.mongoId.required(),
  }),

  myBookingsQuery: Joi.object({
    ...fields.pagination,
    status: Joi.string().valid(
      "Pending",
      "Payment Done",
      "Confirmed",
      "In Progress",
      "Completed",
      "Cancelled",
    ),
  }),
};

// ─────────────────────────────────────────
// AVAILABILITY SCHEMAS
// ─────────────────────────────────────────
const availabilitySchemas = {
  getByMonth: Joi.object({
    month: Joi.string()
      .pattern(/^\d{4}-(0[1-9]|1[0-2])$/)
      .message("Month must be in YYYY-MM format (e.g. 2024-08)")
      .required(),
  }),

  blockDate: Joi.object({
    date: fields.futureDate.required(),
    reason: Joi.string().trim().max(200),
    // "all" blocks both the general and wedding calendars at once —
    // the right default for a photographer marking a personal holiday.
    // Pass "general" or "wedding" to target just one calendar.
    scope: Joi.string().valid("general", "wedding", "all").default("all"),
  }),

  unblockDate: Joi.object({
    date: Joi.string()
      .pattern(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
      .message("Date must be in YYYY-MM-DD format")
      .required(),
  }),

  unblockDateQuery: Joi.object({
    scope: Joi.string().valid("general", "wedding", "all").default("all"),
  }),
};

// ─────────────────────────────────────────
// QUERY (HELP CENTER) SCHEMAS
// ─────────────────────────────────────────
const querySchemas = {
  create: Joi.object({
    subject: Joi.string().trim().min(5).max(150).required(),
    message: Joi.string().trim().min(10).max(2000).required(),
    relatedBookingId: fields.mongoId, // optional — link query to a booking
    category: Joi.string().valid(
      "booking",
      "packages",
      "rental",
      "payment",
      "technical",
      "general",
      "other",
    ),
  }),

  idParam: Joi.object({
    id: fields.mongoId.required(),
  }),

  myQueriesQuery: Joi.object({
    ...fields.pagination,
    status: Joi.string().valid("Open", "In Review", "Resolved", "Closed"),
  }),
};

// ─────────────────────────────────────────
// CHAT SCHEMAS
// ─────────────────────────────────────────
const chatSchemas = {
  message: Joi.object({
    message: Joi.string().trim().min(1).max(1000).required(),
    // conversation history for multi-turn chat context
    history: Joi.array()
      .items(
        Joi.object({
          role: Joi.string().valid("user", "assistant").required(),
          content: Joi.string().trim().max(2000).required(),
        }),
      )
      .max(20) // max 20 turns of history to keep context window manageable
      .default([]),
  }),
};

// ─────────────────────────────────────────
// PAYMENT SCHEMAS
// ─────────────────────────────────────────
const paymentSchemas = {
  createOrder: Joi.object({
    bookingId: fields.mongoId.required(),
  }),

  verifyPayment: Joi.object({
    razorpay_order_id: Joi.string().required(),
    razorpay_payment_id: Joi.string().required(),
    razorpay_signature: Joi.string().required(),
    bookingId: fields.mongoId.required(),
  }),

  refund: Joi.object({
    bookingId: fields.mongoId.required(),
  }),
};

const notificationSchemas = {
  idParam: Joi.object({
    id: fields.mongoId.required(),
  }),

  listQuery: Joi.object({
    ...fields.pagination,
    unreadOnly: Joi.boolean().default(false),
  }),
};

// ─────────────────────────────────────────
// REVIEW SCHEMAS
// ─────────────────────────────────────────
const reviewSchemas = {
  create: Joi.object({
    bookingId: fields.mongoId.required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().trim().max(1000).allow("").default(""),
  }),

  targetIdParam: Joi.object({
    id: fields.mongoId.required(),
  }),

  reviewIdParam: Joi.object({
    id: fields.mongoId.required(),
  }),

  listQuery: Joi.object({
    ...fields.pagination,
  }),
};

module.exports = {
  validate,
  authSchemas,
  photoSchemas,
  packageSchemas,
  cameraSchemas,
  bookingSchemas,
  availabilitySchemas,
  querySchemas,
  chatSchemas,
  paymentSchemas,
  notificationSchemas,
  reviewSchemas,
};