"use strict";

const express = require("express");
const router = express.Router();

const {
  getAllPackages,
  getPackagesGrouped,
  getPopularPackages,
  getPackagesByCategory,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
} = require("../controllers/package.controller");

const {
  validate,
  packageSchemas,
} = require("../middlewares/validate.middleware");

const { protect, restrictTo } = require("../middlewares/auth.middleware");

// ─────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Packages
 *   description: Photography service packages
 */

// GET /api/packages
router.get("/", validate(packageSchemas.query, "query"), getAllPackages);

// GET /api/packages/grouped — all packages by category
router.get("/grouped", getPackagesGrouped);

// GET /api/packages/popular — homepage popular packages
router.get("/popular", getPopularPackages);

// GET /api/packages/category/:category
router.get("/category/:category", getPackagesByCategory);

// GET /api/packages/:id
router.get("/:id", validate(packageSchemas.getById, "params"), getPackageById);

// ─────────────────────────────────────────
// ADMIN ROUTES — JWT + role "admin" required
// ─────────────────────────────────────────

// POST /api/packages
router.post("/", protect, restrictTo("admin"), createPackage);

// PATCH /api/packages/:id
router.patch(
  "/:id",
  protect,
  restrictTo("admin"),
  validate(packageSchemas.getById, "params"),
  updatePackage,
);

// DELETE /api/packages/:id
router.delete(
  "/:id",
  protect,
  restrictTo("admin"),
  validate(packageSchemas.getById, "params"),
  deletePackage,
);

module.exports = router;
