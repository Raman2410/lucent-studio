"use strict";

const { sendError, STATUS } = require("../utils/apiResponse");

// ─────────────────────────────────────────
// CUSTOM APP ERROR CLASS
// throw this anywhere in controllers/services
// gets caught by the global handler below
// ─────────────────────────────────────────
class AppError extends Error {
  /**
   * @param {string} message    — human-readable error message
   * @param {number} statusCode — HTTP status code
   * @param {string} code       — optional machine-readable error code
   */
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // marks it as a known, expected error

    // capture stack trace — excludes constructor from trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─────────────────────────────────────────
// MONGOOSE ERROR HANDLERS
// convert Mongoose-specific errors into
// clean AppErrors with proper HTTP codes
// ─────────────────────────────────────────

/**
 * Handle Mongoose CastError
 * Happens when an invalid MongoDB ObjectId is passed
 * e.g. GET /api/bookings/invalid-id
 */
const handleCastError = (err) =>
  new AppError(`Invalid ${err.path}: ${err.value}`, STATUS.BAD_REQUEST);

/**
 * Handle Mongoose Duplicate Key Error (code 11000)
 * Happens when a unique field is duplicated
 * e.g. registering with an existing email
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  return new AppError(
    `${field.charAt(0).toUpperCase() + field.slice(1)} "${value}" already exists. Please use a different value.`,
    STATUS.CONFLICT,
  );
};

/**
 * Handle Mongoose Validation Error
 * Happens when a required field is missing or fails schema validation
 * e.g. creating a booking without a date
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((e) => e.message);
  return new AppError(
    `Validation failed: ${errors.join(". ")}`,
    STATUS.BAD_REQUEST,
  );
};

// ─────────────────────────────────────────
// JWT ERROR HANDLERS
// ─────────────────────────────────────────

/**
 * Handle invalid JWT token
 * e.g. token has been tampered with
 */
const handleJWTError = () =>
  new AppError("Invalid token. Please log in again.", STATUS.UNAUTHORIZED);

/**
 * Handle expired JWT token
 * e.g. token older than JWT_EXPIRES_IN
 */
const handleJWTExpiredError = () =>
  new AppError(
    "Your session has expired. Please log in again.",
    STATUS.UNAUTHORIZED,
  );

// ─────────────────────────────────────────
// MULTER ERROR HANDLER
// ─────────────────────────────────────────

/**
 * Handle Multer file upload errors
 * e.g. file too large, wrong type
 */
const handleMulterError = (err) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return new AppError(
      "File too large. Maximum size is 10MB.",
      STATUS.BAD_REQUEST,
    );
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return new AppError("Unexpected file field.", STATUS.BAD_REQUEST);
  }
  return new AppError(`File upload error: ${err.message}`, STATUS.BAD_REQUEST);
};

// ─────────────────────────────────────────
// DEV vs PROD ERROR RESPONSES
// ─────────────────────────────────────────

const sendDevError = (err, res) => {
  // in development — send full error details for debugging
  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

const sendProdError = (err, res) => {
  if (err.isOperational) {
    // known, expected errors — safe to send message to client
    return sendError(res, err.statusCode, err.message);
  }
  // unknown/programming errors — don't leak details
  console.error("💥 UNKNOWN ERROR:", err);
  return sendError(
    res,
    STATUS.INTERNAL_ERROR,
    "Something went wrong. Please try again later.",
  );
};

// ─────────────────────────────────────────
// GLOBAL ERROR HANDLER MIDDLEWARE
// must be registered LAST in app.js
// Express identifies it by 4 parameters (err, req, res, next)
// ─────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  // default status and message
  err.statusCode = err.statusCode || STATUS.INTERNAL_ERROR;
  err.message = err.message || "Internal Server Error";

  // log every error with request context
  console.error(`❌ [${req.method}] ${req.originalUrl} →`, err.message);

  let error = { ...err, message: err.message };

  // ── Mongoose Errors ──────────────────
  if (err.name === "CastError") error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateKeyError(err);
  if (err.name === "ValidationError") error = handleValidationError(err);

  // ── JWT Errors ───────────────────────
  if (err.name === "JsonWebTokenError") error = handleJWTError();
  if (err.name === "TokenExpiredError") error = handleJWTExpiredError();

  // ── Multer Errors ────────────────────
  if (err.name === "MulterError") error = handleMulterError(err);

  // ── Send Response ────────────────────
  if (process.env.NODE_ENV === "development") {
    return sendDevError(error, res);
  }

  return sendProdError(error, res);
};

module.exports = { errorHandler, AppError };
