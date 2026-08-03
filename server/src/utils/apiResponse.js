"use strict";

// ─────────────────────────────────────────
// STANDARD API RESPONSE WRAPPER
// every controller uses these — consistent
// response shape across the entire API
//
// Success shape:
// {
//   success: true,
//   message: "...",
//   data: { ... },
//   meta: { ... }   ← optional (pagination)
// }
//
// Error shape:
// {
//   success: false,
//   message: "...",
//   error: "..."    ← only in development
// }
// ─────────────────────────────────────────

/**
 * Send a success response
 * @param {object} res        — Express response object
 * @param {number} statusCode — HTTP status code (default: 200)
 * @param {string} message    — human-readable success message
 * @param {any}    data       — response payload (default: null)
 * @param {object} meta       — optional pagination or extra metadata
 */
const sendSuccess = (
  res,
  statusCode = 200,
  message = "Success",
  data = null,
  meta = null,
) => {
  const response = {
    success: true,
    message,
    data,
  };

  // only include meta if provided (pagination, counts etc.)
  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {object} res        — Express response object
 * @param {number} statusCode — HTTP status code (default: 500)
 * @param {string} message    — human-readable error message
 * @param {string} error      — technical error detail (only shown in development)
 */
const sendError = (
  res,
  statusCode = 500,
  message = "Something went wrong",
  error = null,
) => {
  const response = {
    success: false,
    message,
  };

  // expose raw error only in development — never in production
  if (process.env.NODE_ENV === "development" && error) {
    response.error = error;
  }

  return res.status(statusCode).json(response);
};

/**
 * Build pagination meta object
 * Attach to sendSuccess as the meta argument
 * @param {number} total    — total documents in DB
 * @param {number} page     — current page
 * @param {number} limit    — items per page
 * @returns {object} pagination meta
 */
const paginationMeta = (total, page, limit) => ({
  total,
  page: parseInt(page),
  limit: parseInt(limit),
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

// ─────────────────────────────────────────
// HTTP STATUS CODE CONSTANTS
// avoids magic numbers in controllers
// ─────────────────────────────────────────
const STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};

module.exports = {
  sendSuccess,
  sendError,
  paginationMeta,
  STATUS,
};
