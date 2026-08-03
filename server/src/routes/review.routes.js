"use strict";

const express = require("express");
const router = express.Router();

const {
  createReview,
  getPackageReviews,
  getCameraReviews,
  getMyReviews,
  deleteReview,
} = require("../controllers/review.controller");

const { protect } = require("../middlewares/auth.middleware");
const { validate, reviewSchemas } = require("../middlewares/validate.middleware");

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Package and camera reviews, tied to completed bookings
 */

// ─────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────

// GET /api/reviews/package/:id
router.get(
  "/package/:id",
  validate(reviewSchemas.targetIdParam, "params"),
  validate(reviewSchemas.listQuery, "query"),
  getPackageReviews,
);

// GET /api/reviews/camera/:id
router.get(
  "/camera/:id",
  validate(reviewSchemas.targetIdParam, "params"),
  validate(reviewSchemas.listQuery, "query"),
  getCameraReviews,
);

// ─────────────────────────────────────────
// PROTECTED ROUTES — JWT required
// ─────────────────────────────────────────

// GET /api/reviews/my — must come before /:id-style routes below it
// were there any, but there are none, so order is just for clarity
router.get("/my", protect, getMyReviews);

// POST /api/reviews
router.post("/", protect, validate(reviewSchemas.create), createReview);

// DELETE /api/reviews/:id
router.delete(
  "/:id",
  protect,
  validate(reviewSchemas.reviewIdParam, "params"),
  deleteReview,
);

module.exports = router;
