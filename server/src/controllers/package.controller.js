"use strict";

const Package = require("../models/Package.model");
const { AppError } = require("../middlewares/error.middleware");
const { sendSuccess, STATUS, paginationMeta } = require("../utils/apiResponse");
const {
  cacheGet,
  cacheSet,
  cacheDelete,
  CACHE_KEYS,
  CACHE_TTL,
} = require("../config/redis");
const { invalidatePackageCache } = require("../services/s3.service");

// ─────────────────────────────────────────
// GET ALL PACKAGES
// GET /api/packages
// public — cache-aside
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/packages:
 *   get:
 *     summary: Get all photography packages
 *     tags: [Packages]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [wedding, portrait, commercial, nature, street]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [fixed, custom, hourly]
 *     responses:
 *       200:
 *         description: Packages fetched successfully
 */
const getAllPackages = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, category, type } = req.query;

    // build cache key
    const cacheKey = category
      ? CACHE_KEYS.packagesByCategory(category)
      : CACHE_KEYS.allPackages;

    // try cache for first page with no type filter
    if (page == 1 && !type) {
      const cached = await cacheGet(cacheKey);
      if (cached) {
        return sendSuccess(
          res,
          STATUS.OK,
          "Packages fetched (cached)",
          cached.packages,
          cached.meta,
        );
      }
    }

    // build filter
    const filter = {};
    if (category) filter.category = category;
    if (type) filter.type = type;

    const skip = (page - 1) * limit;

    const [packages, total] = await Promise.all([
      Package.find(filter)
        .sort({ displayOrder: 1, isPopular: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select(
          "name tagline category type price includes duration deliverables isPopular displayOrder ratingsAverage ratingsCount",
        ),
      Package.countDocuments(filter),
    ]);

    const meta = paginationMeta(total, page, limit);

    // cache first page with no type filter
    if (page == 1 && !type) {
      await cacheSet(cacheKey, { packages, meta }, CACHE_TTL.packages);
    }

    return sendSuccess(
      res,
      STATUS.OK,
      "Packages fetched successfully",
      packages,
      meta,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET PACKAGES GROUPED BY CATEGORY
// GET /api/packages/grouped
// public — for packages listing page
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/packages/grouped:
 *   get:
 *     summary: Get all packages grouped by category
 *     tags: [Packages]
 *     responses:
 *       200:
 *         description: Packages grouped by category
 */
const getPackagesGrouped = async (req, res, next) => {
  try {
    const cacheKey = `${CACHE_KEYS.allPackages}:grouped`;

    // try cache
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return sendSuccess(
        res,
        STATUS.OK,
        "Packages grouped fetched (cached)",
        cached,
      );
    }

    const grouped = await Package.getGroupedByCategory();

    // cache for 12 hours
    await cacheSet(cacheKey, grouped, CACHE_TTL.packages);

    return sendSuccess(res, STATUS.OK, "Packages grouped by category", grouped);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET POPULAR PACKAGES
// GET /api/packages/popular
// public — for homepage
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/packages/popular:
 *   get:
 *     summary: Get popular packages for homepage
 *     tags: [Packages]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 6 }
 *     responses:
 *       200:
 *         description: Popular packages fetched
 */
const getPopularPackages = async (req, res, next) => {
  try {
    const { limit = 6 } = req.query;

    const cacheKey = `${CACHE_KEYS.allPackages}:popular:${limit}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      return sendSuccess(
        res,
        STATUS.OK,
        "Popular packages fetched (cached)",
        cached,
      );
    }

    const packages = await Package.getPopular(parseInt(limit));

    await cacheSet(cacheKey, packages, CACHE_TTL.packages);

    return sendSuccess(res, STATUS.OK, "Popular packages fetched", packages);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET PACKAGES BY CATEGORY
// GET /api/packages/category/:category
// public
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/packages/category/{category}:
 *   get:
 *     summary: Get packages by photography category
 *     tags: [Packages]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [wedding, portrait, commercial, nature, street]
 *     responses:
 *       200:
 *         description: Packages by category fetched
 */
const getPackagesByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;

    const cacheKey = CACHE_KEYS.packagesByCategory(category);

    const cached = await cacheGet(cacheKey);
    if (cached) {
      return sendSuccess(
        res,
        STATUS.OK,
        `Packages for ${category} fetched (cached)`,
        cached,
      );
    }

    const packages = await Package.find({ category })
      .sort({ displayOrder: 1, isPopular: -1 })
      .select(
        "name tagline type price includes duration deliverables isPopular ratingsAverage ratingsCount",
      );

    await cacheSet(cacheKey, packages, CACHE_TTL.packages);

    return sendSuccess(
      res,
      STATUS.OK,
      `Packages for category: ${category}`,
      packages,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET SINGLE PACKAGE
// GET /api/packages/:id
// public
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/packages/{id}:
 *   get:
 *     summary: Get a single package by ID
 *     tags: [Packages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Package fetched
 *       404:
 *         description: Package not found
 */
const getPackageById = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id);

    if (!pkg) {
      return next(new AppError("Package not found", STATUS.NOT_FOUND));
    }

    return sendSuccess(res, STATUS.OK, "Package fetched", pkg);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// CREATE PACKAGE
// POST /api/packages
// admin only (no auth — managed via code)
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/packages:
 *   post:
 *     summary: Create a new photography package
 *     tags: [Packages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Package'
 *     responses:
 *       201:
 *         description: Package created successfully
 */
const createPackage = async (req, res, next) => {
  try {
    const pkg = await Package.create(req.body);

    // invalidate all package caches
    await invalidatePackageCache();

    console.log(`✅ Package created → ${pkg.name} | ${pkg.category}`);

    return sendSuccess(
      res,
      STATUS.CREATED,
      "Package created successfully",
      pkg,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// UPDATE PACKAGE
// PATCH /api/packages/:id
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/packages/{id}:
 *   patch:
 *     summary: Update a photography package
 *     tags: [Packages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Package'
 *     responses:
 *       200:
 *         description: Package updated
 *       404:
 *         description: Package not found
 */
const updatePackage = async (req, res, next) => {
  try {
    const pkg = await Package.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!pkg) {
      return next(new AppError("Package not found", STATUS.NOT_FOUND));
    }

    await invalidatePackageCache();

    console.log(`✅ Package updated → ${pkg.name}`);

    return sendSuccess(res, STATUS.OK, "Package updated successfully", pkg);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE PACKAGE
// DELETE /api/packages/:id
// soft delete — sets isActive: false
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/packages/{id}:
 *   delete:
 *     summary: Delete a photography package
 *     tags: [Packages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Package deleted
 *       404:
 *         description: Package not found
 */
const deletePackage = async (req, res, next) => {
  try {
    // soft delete — isActive: false
    // existing bookings referencing this package remain valid
    const pkg = await Package.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );

    if (!pkg) {
      return next(new AppError("Package not found", STATUS.NOT_FOUND));
    }

    await invalidatePackageCache();

    console.log(`🗑️  Package soft deleted → ${pkg.name}`);

    return sendSuccess(res, STATUS.OK, "Package deleted successfully");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPackages,
  getPackagesGrouped,
  getPopularPackages,
  getPackagesByCategory,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
};
