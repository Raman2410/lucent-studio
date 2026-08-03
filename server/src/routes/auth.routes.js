"use strict";

const express = require("express");
const router = express.Router();

const {
  register,
  login,
  verifyEmail,
  resendVerification,
  logout,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  deleteMe,
} = require("../controllers/auth.controller");

const { protect } = require("../middlewares/auth.middleware");

const { validate, authSchemas } = require("../middlewares/validate.middleware");

// ─────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication and account management
 */

// POST /api/auth/register
router.post("/register", validate(authSchemas.register), register);

// POST /api/auth/login
router.post("/login", validate(authSchemas.login), login);

// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  validate(authSchemas.forgotPassword),
  forgotPassword,
);

// PATCH /api/auth/reset-password/:token
router.patch(
  "/reset-password/:token",
  validate(authSchemas.resetPasswordParams, "params"),
  validate(authSchemas.resetPassword),
  resetPassword,
);

// GET /api/auth/verify-email/:token
router.get(
  "/verify-email/:token",
  validate(authSchemas.verifyEmailParams, "params"),
  verifyEmail,
);

// ─────────────────────────────────────────
// PROTECTED ROUTES — JWT required
// ─────────────────────────────────────────

// POST /api/auth/resend-verification
router.post("/resend-verification", protect, resendVerification);

// POST /api/auth/logout
router.post("/logout", protect, logout);

// GET  /api/auth/me
// PATCH /api/auth/me
// DELETE /api/auth/me
router
  .route("/me")
  .get(protect, getMe)
  .patch(protect, updateMe)
  .delete(protect, deleteMe);

// PATCH /api/auth/change-password
router.patch(
  "/change-password",
  protect,
  validate(authSchemas.changePassword),
  changePassword,
);

module.exports = router;
