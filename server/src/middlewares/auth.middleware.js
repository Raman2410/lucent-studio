"use strict";

const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const { AppError } = require("./error.middleware");
const { sendError, STATUS } = require("../utils/apiResponse");

// ─────────────────────────────────────────
// EXTRACT TOKEN
// checks Authorization header first,
// then falls back to httpOnly cookie
// ─────────────────────────────────────────
const extractToken = (req) => {
  // 1. check Authorization: Bearer <token> header (Postman / API clients)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    return req.headers.authorization.split(" ")[1];
  }

  // 2. check httpOnly cookie (browser clients)
  if (req.cookies && req.cookies.jwt) {
    return req.cookies.jwt;
  }

  return null;
};

// ─────────────────────────────────────────
// PROTECT — hard auth guard
// blocks the request if no valid JWT
// use on routes that REQUIRE login
// e.g. POST /api/bookings, POST /api/queries
// ─────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    // 1. extract token
    const token = extractToken(req);

    if (!token) {
      return next(
        new AppError(
          "You are not logged in. Please log in to continue.",
          STATUS.UNAUTHORIZED,
        ),
      );
    }

    // 2. verify token — throws if invalid or expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. check if user still exists
    // (handles case where account was deleted after token was issued)
   const currentUser = await User.findById(decoded.id).select(
     "-password +passwordChangedAt",
   );

    if (!currentUser) {
      return next(
        new AppError(
          "The user associated with this token no longer exists.",
          STATUS.UNAUTHORIZED,
        ),
      );
    }

    // 4. check if user changed password after token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError(
          "Your password was recently changed. Please log in again.",
          STATUS.UNAUTHORIZED,
        ),
      );
    }

    // 5. attach user to request — available in all downstream middleware & controllers
    req.user = currentUser;

    next();
  } catch (error) {
    next(error); // passes JWT errors to global error handler
  }
};

// ─────────────────────────────────────────
// RESTRICT TO — role guard
// use AFTER protect on routes that require
// a specific role, e.g. restrictTo("admin")
// ─────────────────────────────────────────
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          "You do not have permission to perform this action.",
          STATUS.FORBIDDEN,
        ),
      );
    }
    next();
  };
};

// ─────────────────────────────────────────
// OPTIONAL AUTH — soft auth check
// does NOT block the request if no token
// attaches user to req if token is valid
// use on public routes that behave differently
// when user is logged in
// ─────────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      req.user = null; // no user — route handles it
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id).select("-password");

    req.user = currentUser || null;
    next();
  } catch (error) {
    // invalid/expired token on optional route — just proceed without user
    req.user = null;
    next();
  }
};

// ─────────────────────────────────────────
// IS LOGGED IN — check without blocking
// returns boolean — useful for conditional
// logic inside controllers
// ─────────────────────────────────────────
const isLoggedIn = (req) => {
  return !!req.user;
};

// ─────────────────────────────────────────
// SIGN JWT TOKEN — used in auth controller
// ─────────────────────────────────────────

/**
 * Sign a JWT token for a user
 * @param {string} userId — MongoDB _id
 * @returns {string} signed JWT token
 */
const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// ─────────────────────────────────────────
// CREATE & SEND TOKEN — used in auth controller
// signs token, sets httpOnly cookie, sends response
// ─────────────────────────────────────────

/**
 * Create JWT, set httpOnly cookie, return token + user
 * @param {object} user       — Mongoose user document
 * @param {number} statusCode — HTTP status code
 * @param {object} res        — Express response object
 * @param {string} message    — response message
 */
const createSendToken = (user, statusCode, res, message = "Success") => {
  const token = signToken(user._id);

  // cookie options
  const cookieOptions = {
    expires: new Date(
      Date.now() +
        parseInt(process.env.JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true, // not accessible via JavaScript — XSS protection
    sameSite: "lax", // CSRF protection
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
  };

  // set JWT in httpOnly cookie
  res.cookie("jwt", token, cookieOptions);

  // remove password from output
  user.password = undefined;

  return res.status(statusCode).json({
    success: true,
    message,
    token, // also send token in body for Postman / API clients
    data: { user },
  });
};

// ─────────────────────────────────────────
// CLEAR TOKEN COOKIE — used on logout
// ─────────────────────────────────────────
const clearTokenCookie = (res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 1000), // expires in 1 second
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
};

module.exports = {
  protect,
  restrictTo,
  optionalAuth,
  isLoggedIn,
  signToken,
  createSendToken,
  clearTokenCookie,
  extractToken,
};
