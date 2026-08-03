"use strict";

const Camera = require("../models/Camera.model");
const { AppError } = require("../middlewares/error.middleware");
const { sendSuccess, STATUS, paginationMeta } = require("../utils/apiResponse");
const {
  cacheGet,
  cacheSet,
  CACHE_KEYS,
  CACHE_TTL,
} = require("../config/redis");
const {
  prepareCameraData,
  deleteCameraImages,
  invalidateCameraCache,
} = require("../services/s3.service");
const Availability = require("../models/Availability.model");

// ─────────────────────────────────────────
// GET ALL CAMERAS
// GET /api/cameras
// public — cache-aside
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/cameras:
 *   get:
 *     summary: Get all available cameras for rent
 *     tags: [Cameras]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: rentalType
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekend]
 *     responses:
 *       200:
 *         description: Cameras fetched successfully
 */
const getAllCameras = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, rentalType } = req.query;

    // try cache for first page with no filter
    if (page == 1 && !rentalType) {
      const cached = await cacheGet(CACHE_KEYS.allCameras);
      if (cached) {
        return sendSuccess(
          res,
          STATUS.OK,
          "Cameras fetched (cached)",
          cached.cameras,
          cached.meta,
        );
      }
    }

    const filter = { isAvailable: true };
    const skip = (page - 1) * limit;

    const [cameras, total] = await Promise.all([
      Camera.find(filter)
        .sort({ displayOrder: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select(
          "name brand model image specs rentalRates accessories photographerAddon isAvailable unavailabilityReason displayOrder ratingsAverage ratingsCount",
        ),
      Camera.countDocuments(filter),
    ]);

    const meta = paginationMeta(total, page, limit);

    // cache first page
    if (page == 1 && !rentalType) {
      await cacheSet(
        CACHE_KEYS.allCameras,
        { cameras, meta },
        CACHE_TTL.cameras,
      );
    }

    return sendSuccess(
      res,
      STATUS.OK,
      "Cameras fetched successfully",
      cameras,
      meta,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET SINGLE CAMERA
// GET /api/cameras/:id
// public — full details
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/cameras/{id}:
 *   get:
 *     summary: Get a single camera by ID
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Camera fetched
 *       404:
 *         description: Camera not found
 */
const getCameraById = async (req, res, next) => {
  try {
    const camera = await Camera.findById(req.params.id);

    if (!camera) {
      return next(new AppError("Camera not found", STATUS.NOT_FOUND));
    }

    return sendSuccess(res, STATUS.OK, "Camera fetched", camera);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET CAMERA AVAILABILITY
// GET /api/cameras/:id/availability
// public — checks availability for a specific month
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/cameras/{id}/availability:
 *   get:
 *     summary: Get availability for a camera in a given month
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           example: "2024-08"
 *     responses:
 *       200:
 *         description: Camera availability fetched
 *       404:
 *         description: Camera not found
 */
const getCameraAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { month } = req.query;

    const camera = await Camera.findById(id).select(
      "name isAvailable unavailabilityReason",
    );

    if (!camera) {
      return next(new AppError("Camera not found", STATUS.NOT_FOUND));
    }

    // if camera is globally unavailable
    if (!camera.isAvailable) {
      return sendSuccess(res, STATUS.OK, "Camera availability fetched", {
        camera: { id: camera._id, name: camera.name },
        isGloballyAvailable: false,
        reason: camera.unavailabilityReason || "Under maintenance",
        monthlyAvailability: [],
      });
    }

    // get monthly availability from unified calendar
    const availability = month
      ? await Availability.getMonthAvailability(month)
      : [];

    return sendSuccess(res, STATUS.OK, "Camera availability fetched", {
      camera: { id: camera._id, name: camera.name },
      isGloballyAvailable: true,
      monthlyAvailability: availability,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// CALCULATE RENTAL COST
// POST /api/cameras/:id/calculate
// public — cost estimate before booking
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/cameras/{id}/calculate:
 *   post:
 *     summary: Calculate rental cost for a camera
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rentalType]
 *             properties:
 *               rentalType:
 *                 type: string
 *                 enum: [hourly, daily, weekend]
 *               quantity:
 *                 type: number
 *                 example: 2
 *               accessories:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["Tripod", "50mm Lens"]
 *               withPhotographer:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cost calculated
 *       404:
 *         description: Camera not found
 */
const calculateRentalCost = async (req, res, next) => {
  try {
    const {
      rentalType,
      quantity = 1,
      accessories = [],
      withPhotographer = false,
    } = req.body;

    const camera = await Camera.findById(req.params.id);

    if (!camera) {
      return next(new AppError("Camera not found", STATUS.NOT_FOUND));
    }

    if (!camera.isAvailable) {
      return next(
        new AppError(
          `Camera is currently unavailable: ${camera.unavailabilityReason || "Under maintenance"}`,
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // use model instance method
    const costBreakdown = camera.calculateRentalCost(
      rentalType,
      quantity,
      accessories,
      withPhotographer,
    );

    return sendSuccess(res, STATUS.OK, "Rental cost calculated", {
      camera: { id: camera._id, name: camera.name, brand: camera.brand },
      rentalType,
      quantity,
      selectedAccessories: accessories,
      withPhotographer,
      breakdown: costBreakdown,
      formattedTotal: new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(costBreakdown.total),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// CREATE CAMERA
// POST /api/cameras
// requires: uploadCameraWithAccessories + pushCameraWithAccessoriesToS3
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/cameras:
 *   post:
 *     summary: Add a new camera for rental
 *     tags: [Cameras]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image, name, brand, model, hourlyRate, dailyRate, weekendRate]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               name:
 *                 type: string
 *               brand:
 *                 type: string
 *               model:
 *                 type: string
 *               hourlyRate:
 *                 type: number
 *               dailyRate:
 *                 type: number
 *               weekendRate:
 *                 type: number
 *     responses:
 *       201:
 *         description: Camera created successfully
 */
const createCamera = async (req, res, next) => {
  try {
    // req.uploadedCameraImage + req.uploadedAccessoryImages
    // set by pushCameraWithAccessoriesToS3 middleware
    const cameraData = prepareCameraData(
      req.uploadedCameraImage,
      req.uploadedAccessoryImages,
      req.body,
    );

    const camera = await Camera.create(cameraData);

    await invalidateCameraCache();

    console.log(`✅ Camera created → ${camera.brand} ${camera.name}`);

    return sendSuccess(
      res,
      STATUS.CREATED,
      "Camera added successfully",
      camera,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// UPDATE CAMERA
// PATCH /api/cameras/:id
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/cameras/{id}:
 *   patch:
 *     summary: Update camera details
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Camera updated
 *       404:
 *         description: Camera not found
 */
const updateCamera = async (req, res, next) => {
  try {
    // allowed top-level fields for JSON update
    const allowedFields = [
      "name",
      "brand",
      "model",
      "description",
      "rentalRates",
      "specs",
      "isAvailable",
      "unavailabilityReason",
      "photographerAddon",
      "rentalTerms",
      "displayOrder",
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const camera = await Camera.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!camera) {
      return next(new AppError("Camera not found", STATUS.NOT_FOUND));
    }

    await invalidateCameraCache();

    console.log(`✅ Camera updated → ${camera.brand} ${camera.name}`);

    return sendSuccess(res, STATUS.OK, "Camera updated successfully", camera);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// TOGGLE CAMERA AVAILABILITY
// PATCH /api/cameras/:id/toggle-availability
// quick toggle for maintenance mode
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/cameras/{id}/toggle-availability:
 *   patch:
 *     summary: Toggle camera availability (maintenance mode)
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Availability toggled
 */
const toggleCameraAvailability = async (req, res, next) => {
  try {
    const camera = await Camera.findById(req.params.id);

    if (!camera) {
      return next(new AppError("Camera not found", STATUS.NOT_FOUND));
    }

    camera.isAvailable = !camera.isAvailable;
    camera.unavailabilityReason = camera.isAvailable
      ? ""
      : req.body.reason || "Under maintenance";

    await camera.save();
    await invalidateCameraCache();

    const status = camera.isAvailable ? "available" : "unavailable";
    console.log(`✅ Camera ${camera.name} → ${status}`);

    return sendSuccess(res, STATUS.OK, `Camera marked as ${status}`, {
      id: camera._id,
      name: camera.name,
      isAvailable: camera.isAvailable,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE CAMERA
// DELETE /api/cameras/:id
// hard delete — removes S3 images + DB doc
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/cameras/{id}:
 *   delete:
 *     summary: Delete a camera
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Camera deleted
 *       404:
 *         description: Camera not found
 */
const deleteCamera = async (req, res, next) => {
  try {
    const camera = await Camera.findById(req.params.id);

    if (!camera) {
      return next(new AppError("Camera not found", STATUS.NOT_FOUND));
    }

    // 1. delete all S3 images (camera + accessories)
    await deleteCameraImages(camera);

    // 2. delete from MongoDB
    await camera.deleteOne();

    // 3. invalidate cache
    await invalidateCameraCache();

    console.log(`🗑️  Camera deleted → ${camera.brand} ${camera.name}`);

    return sendSuccess(res, STATUS.OK, "Camera deleted successfully");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCameras,
  getCameraById,
  getCameraAvailability,
  calculateRentalCost,
  createCamera,
  updateCamera,
  toggleCameraAvailability,
  deleteCamera,
};
