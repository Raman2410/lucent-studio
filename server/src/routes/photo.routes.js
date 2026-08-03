"use strict";

const express = require("express");
const router = express.Router();

const {
  getAllPhotos,
  getFeaturedPhotos,
  getPhotosByCategory,
  getPhotoById,
  uploadPhoto,
  uploadPhotoBulk,
  updatePhoto,
  deletePhoto,
  deletePhotoBulk,
} = require("../controllers/photo.controller");

const {
  uploadSinglePhoto,
  uploadMultiplePhotos,
  pushSinglePhotoToS3,
  pushMultiplePhotosToS3,
  handleMulterError,
} = require("../middlewares/upload.middleware");

const {
  validate,
  photoSchemas,
} = require("../middlewares/validate.middleware");

const { protect, restrictTo } = require("../middlewares/auth.middleware");

// ─────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Photos
 *   description: Portfolio photo management
 */

// GET /api/photos
router.get("/", validate(photoSchemas.query, "query"), getAllPhotos);

// GET /api/photos/featured
router.get("/featured", getFeaturedPhotos);

// GET /api/photos/category/:category
router.get(
  "/category/:category",
  validate(photoSchemas.getByCategory, "params"),
  getPhotosByCategory,
);

// GET /api/photos/:id
router.get("/:id", getPhotoById);

// ─────────────────────────────────────────
// ADMIN ROUTES — JWT + role "admin" required
// upload, update, delete operations
// ─────────────────────────────────────────

// POST /api/photos/upload — single photo
router.post(
  "/upload",
  protect,
  restrictTo("admin"),
  uploadSinglePhoto,
  handleMulterError,
  pushSinglePhotoToS3,
  uploadPhoto,
);

// POST /api/photos/upload/bulk — up to 10 photos
router.post(
  "/upload/bulk",
  protect,
  restrictTo("admin"),
  uploadMultiplePhotos,
  handleMulterError,
  pushMultiplePhotosToS3,
  uploadPhotoBulk,
);

// DELETE /api/photos/bulk — bulk delete by IDs
router.delete("/bulk", protect, restrictTo("admin"), deletePhotoBulk);

// PATCH /api/photos/:id — update metadata
router.patch("/:id", protect, restrictTo("admin"), updatePhoto);

// DELETE /api/photos/:id — single delete
router.delete("/:id", protect, restrictTo("admin"), deletePhoto);

module.exports = router;
