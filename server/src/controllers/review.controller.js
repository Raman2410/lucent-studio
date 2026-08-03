"use strict";

const Review = require("../models/Review.model");
const Booking = require("../models/Booking.model");
const { AppError } = require("../middlewares/error.middleware");
const { sendSuccess, STATUS, paginationMeta } = require("../utils/apiResponse");

// ─────────────────────────────────────────
// CREATE REVIEW
// POST /api/reviews
// protected — JWT required
// only allowed for the booking's owner, once the booking is
// "Completed", and only once per booking
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Leave a review for a completed booking
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId, rating]
 *             properties:
 *               bookingId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 example: 5
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review created successfully
 *       400:
 *         description: Booking not eligible for review (not completed, or already reviewed)
 *       403:
 *         description: Booking does not belong to this user
 *       404:
 *         description: Booking not found
 */
const createReview = async (req, res, next) => {
  try {
    const { bookingId, rating, comment } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return next(new AppError("Booking not found", STATUS.NOT_FOUND));
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return next(
        new AppError("This booking does not belong to you", STATUS.FORBIDDEN),
      );
    }

    if (booking.status !== "Completed") {
      return next(
        new AppError(
          "You can only review a booking after it's completed",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    if (booking.hasReview) {
      return next(
        new AppError(
          "You've already reviewed this booking",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    const targetType = booking.type === "photography" ? "package" : "camera";
    const targetId =
      booking.type === "photography" ? booking.package : booking.camera;

    if (!targetId) {
      return next(
        new AppError(
          "This booking has no associated package or camera to review",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    const review = await Review.create({
      user: req.user._id,
      booking: booking._id,
      targetType,
      [targetType]: targetId,
      userSnapshot: { name: req.user.name },
      rating,
      comment,
    });

    booking.hasReview = true;
    await booking.save({ validateBeforeSave: false });

    console.log(
      `✅ Review created → ${targetType}:${targetId} | ${rating}★ | User: ${req.user.email}`,
    );

    return sendSuccess(res, STATUS.CREATED, "Review submitted — thank you!", {
      review,
    });
  } catch (error) {
    // duplicate key error — the unique index on `booking` caught a race
    if (error.code === 11000) {
      return next(
        new AppError(
          "You've already reviewed this booking",
          STATUS.BAD_REQUEST,
        ),
      );
    }
    next(error);
  }
};

// ─────────────────────────────────────────
// LIST REVIEWS FOR A PACKAGE
// GET /api/reviews/package/:id
// public route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/reviews/package/{id}:
 *   get:
 *     summary: List reviews for a package
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of reviews with average rating
 */
const getPackageReviews = async (req, res, next) => {
  try {
    return await listReviewsFor("package", req, res, next);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// LIST REVIEWS FOR A CAMERA
// GET /api/reviews/camera/:id
// public route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/reviews/camera/{id}:
 *   get:
 *     summary: List reviews for a camera
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of reviews with average rating
 */
const getCameraReviews = async (req, res, next) => {
  try {
    return await listReviewsFor("camera", req, res, next);
  } catch (error) {
    next(error);
  }
};

/**
 * Shared implementation for the two public listing endpoints above.
 * @param {"package"|"camera"} targetType
 */
const listReviewsFor = async (targetType, req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const filter = { [targetType]: id };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-user"), // userSnapshot is enough for public display
    Review.countDocuments(filter),
  ]);

  // pull the cached average/count straight off the target doc — cheaper
  // than a second aggregation, and it's exactly what Review.model.js
  // keeps in sync on every save/remove
  const Model =
    targetType === "package"
      ? require("../models/Package.model")
      : require("../models/Camera.model");
  const target = await Model.findById(id).select("ratingsAverage ratingsCount");

  return sendSuccess(
    res,
    STATUS.OK,
    "Reviews fetched successfully",
    {
      reviews,
      ratingsAverage: target?.ratingsAverage || 0,
      ratingsCount: target?.ratingsCount || 0,
    },
    paginationMeta(total, page, limit),
  );
};

// ─────────────────────────────────────────
// MY REVIEWS
// GET /api/reviews/my
// protected route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/reviews/my:
 *   get:
 *     summary: List the current user's own reviews
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of the user's reviews
 */
const getMyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("package", "name")
      .populate("camera", "name brand");

    return sendSuccess(res, STATUS.OK, "Your reviews fetched successfully", {
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE REVIEW
// DELETE /api/reviews/:id
// protected — owner or admin only
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/reviews/{id}:
 *   delete:
 *     summary: Delete a review (owner or admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       403:
 *         description: Not the review owner or an admin
 *       404:
 *         description: Review not found
 */
const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return next(new AppError("Review not found", STATUS.NOT_FOUND));
    }

    const isOwner = review.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return next(
        new AppError("You can only delete your own reviews", STATUS.FORBIDDEN),
      );
    }

    await Review.findOneAndDelete({ _id: review._id });

    // recalculate explicitly here rather than relying solely on the
    // findOneAndDelete post-hook's returned promise being awaited —
    // this guarantees the target's ratingsAverage/ratingsCount are
    // already up to date by the time this request responds
    await Review.recalculateRatings(
      review.targetType,
      review.targetType === "package" ? review.package : review.camera,
    );

    // free up the booking to be reviewed again isn't desired — a
    // deleted review still "used up" the one-review-per-booking slot
    // intentionally, to discourage delete-and-repost review farming

    console.log(
      `🗑️  Review deleted → ${review._id} | by ${isAdmin && !isOwner ? "admin" : "owner"}`,
    );

    return sendSuccess(res, STATUS.OK, "Review deleted successfully");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getPackageReviews,
  getCameraReviews,
  getMyReviews,
  deleteReview,
};
