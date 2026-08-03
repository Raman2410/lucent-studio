"use strict";

const express = require("express");
const router = express.Router();

const {
  getAllCameras,
  getCameraById,
  getCameraAvailability,
  calculateRentalCost,
  createCamera,
  updateCamera,
  toggleCameraAvailability,
  deleteCamera,
} = require("../controllers/camera.controller");

const {
  uploadCameraWithAccessories,
  pushCameraWithAccessoriesToS3,
  uploadCameraImage,
  pushOptionalCameraImageToS3,
  handleMulterError,
} = require("../middlewares/upload.middleware");

const {
  validate,
  cameraSchemas,
} = require("../middlewares/validate.middleware");

const { protect, restrictTo } = require("../middlewares/auth.middleware");

// ─────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Cameras
 *   description: Camera rental management
 */

// GET /api/cameras
router.get("/", validate(cameraSchemas.query, "query"), getAllCameras);

// GET /api/cameras/:id
router.get("/:id", validate(cameraSchemas.getById, "params"), getCameraById);

// GET /api/cameras/:id/availability?month=YYYY-MM
router.get(
  "/:id/availability",
  validate(cameraSchemas.getById, "params"),
  getCameraAvailability,
);

// POST /api/cameras/:id/calculate — cost estimate
router.post(
  "/:id/calculate",
  validate(cameraSchemas.getById, "params"),
  calculateRentalCost,
);

// ─────────────────────────────────────────
// ADMIN ROUTES — JWT + role "admin" required
// ─────────────────────────────────────────

// POST /api/cameras — create with images
router.post(
  "/",
  protect,
  restrictTo("admin"),
  uploadCameraWithAccessories,
  handleMulterError,
  pushCameraWithAccessoriesToS3,
  createCamera,
);

// PATCH /api/cameras/:id — update details (JSON only)
router.patch(
  "/:id",
  protect,
  restrictTo("admin"),
  validate(cameraSchemas.getById, "params"),
  updateCamera,
);

// PATCH /api/cameras/:id/toggle-availability
router.patch(
  "/:id/toggle-availability",
  protect,
  restrictTo("admin"),
  validate(cameraSchemas.getById, "params"),
  toggleCameraAvailability,
);

// DELETE /api/cameras/:id
router.delete(
  "/:id",
  protect,
  restrictTo("admin"),
  validate(cameraSchemas.getById, "params"),
  deleteCamera,
);

module.exports = router;
