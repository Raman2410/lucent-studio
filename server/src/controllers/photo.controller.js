"use strict";

const Photo = require("../models/Photo.model");
const { AppError } = require("../middlewares/error.middleware");
const { sendSuccess, STATUS, paginationMeta } = require("../utils/apiResponse");
const {
  cacheGet,
  cacheSet,
  CACHE_KEYS,
  CACHE_TTL,
} = require("../config/redis");
const {
  preparePhotoData,
  prepareManyPhotoData,
  deletePhotoFromS3,
  deleteManyPhotosFromS3,
  invalidatePhotoCache,
  invalidatePhotoCategoryCache,
} = require("../services/s3.service");

// ─────────────────────────────────────────
// GET ALL PHOTOS
// GET /api/photos
// public route — cache-aside with Redis
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/photos:
 *   get:
 *     summary: Get all portfolio photos
 *     tags: [Photos]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12 }
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [wedding, portrait, commercial, nature, street]
 *       - in: query
 *         name: featured
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Photos fetched successfully
 */
const getAllPhotos = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, category, featured, tag } = req.query;

    // build cache key based on query params — tag makes results
    // specific enough that we skip the cache for tag-filtered
    // requests entirely rather than growing the cache-key scheme
    const cacheKey = category
      ? CACHE_KEYS.photosByCategory(category)
      : CACHE_KEYS.allPhotos;

    // try Redis cache first (skipped when filtering by tag)
    const cached = !tag && (await cacheGet(cacheKey));
    if (cached && !featured && page == 1) {
      return sendSuccess(
        res,
        STATUS.OK,
        "Photos fetched (cached)",
        cached.photos,
        cached.meta,
      );
    }

    // build query filter
    const filter = {};
    if (category) filter.category = category;
    if (featured === "true") filter.isFeatured = true;
    if (tag) filter.tags = tag; // matches if `tag` is anywhere in the tags array

    const skip = (page - 1) * limit;

    const [photos, total] = await Promise.all([
      Photo.find(filter)
        .sort({ displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select(
          "url category title description displayOrder dimensions isFeatured tags",
        ),
      Photo.countDocuments(filter),
    ]);

    const meta = paginationMeta(total, page, limit);

    // cache first page results (no featured/tag filter)
    // skip caching empty results — otherwise a category checked before
    // it has any photos gets stuck showing empty for CACHE_TTL.photos
    // even after photos are added directly (e.g. via a seed script)
    if (!featured && !tag && page == 1 && photos.length > 0) {
      await cacheSet(cacheKey, { photos, meta }, CACHE_TTL.photos);
    }

    return sendSuccess(
      res,
      STATUS.OK,
      "Photos fetched successfully",
      photos,
      meta,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET FEATURED PHOTOS
// GET /api/photos/featured
// public route — for homepage hero + scattered sections
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/photos/featured:
 *   get:
 *     summary: Get featured photos for homepage
 *     tags: [Photos]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12 }
 *     responses:
 *       200:
 *         description: Featured photos fetched
 */
const getFeaturedPhotos = async (req, res, next) => {
  try {
    const { limit = 12 } = req.query;

    // check cache
    const cacheKey = `${CACHE_KEYS.allPhotos}:featured:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return sendSuccess(
        res,
        STATUS.OK,
        "Featured photos fetched (cached)",
        cached,
      );
    }

    const photos = await Photo.getFeatured(parseInt(limit));

    // cache for 6 hours
    await cacheSet(cacheKey, photos, CACHE_TTL.photos);

    return sendSuccess(res, STATUS.OK, "Featured photos fetched", photos);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET PHOTOS BY CATEGORY
// GET /api/photos/category/:category
// public route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/photos/category/{category}:
 *   get:
 *     summary: Get photos by category
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [wedding, portrait, commercial, nature, street]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12 }
 *     responses:
 *       200:
 *         description: Photos by category fetched
 */
const getPhotosByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 12 } = req.query;

    // check Redis cache (first page only)
    const cacheKey = CACHE_KEYS.photosByCategory(category);
    if (page == 1) {
      const cached = await cacheGet(cacheKey);
      if (cached) {
        return sendSuccess(
          res,
          STATUS.OK,
          `Photos fetched for ${category} (cached)`,
          cached.photos,
          cached.meta,
        );
      }
    }

    const { photos, total } = await Photo.getByCategory(
      category,
      parseInt(page),
      parseInt(limit),
    );

    const meta = paginationMeta(total, page, limit);

    // cache first page — skip caching empty results, otherwise this
    // category gets stuck showing empty for CACHE_TTL.photos even
    // after photos are added directly (e.g. via a seed script), since
    // nothing else invalidates this key until it naturally expires
    if (page == 1 && photos.length > 0) {
      await cacheSet(cacheKey, { photos, meta }, CACHE_TTL.photos);
    }

    return sendSuccess(
      res,
      STATUS.OK,
      `Photos fetched for category: ${category}`,
      photos,
      meta,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET SINGLE PHOTO
// GET /api/photos/:id
// public route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/photos/{id}:
 *   get:
 *     summary: Get a single photo by ID
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Photo fetched
 *       404:
 *         description: Photo not found
 */
const getPhotoById = async (req, res, next) => {
  try {
    const photo = await Photo.findById(req.params.id);

    if (!photo) {
      return next(new AppError("Photo not found", STATUS.NOT_FOUND));
    }

    return sendSuccess(res, STATUS.OK, "Photo fetched", photo);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// UPLOAD SINGLE PHOTO
// POST /api/photos/upload
// requires: uploadSinglePhoto + pushSinglePhotoToS3 middlewares
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/photos/upload:
 *   post:
 *     summary: Upload a single portfolio photo
 *     tags: [Photos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photo, category]
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *                 enum: [wedding, portrait, commercial, nature, street]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               isFeatured:
 *                 type: boolean
 *               displayOrder:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Photo uploaded successfully
 */
const uploadPhoto = async (req, res, next) => {
  try {
    // req.uploadedFile = { key, url } — set by pushSinglePhotoToS3 middleware
    const photoData = preparePhotoData(req.uploadedFile, req.file, req.body);
    const photo = await Photo.create(photoData);

    // invalidate photo caches
    await invalidatePhotoCache();

    console.log(
      `✅ Photo uploaded → ${photo._id} | category: ${photo.category}`,
    );

    return sendSuccess(
      res,
      STATUS.CREATED,
      "Photo uploaded successfully",
      photo,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// BULK UPLOAD PHOTOS
// POST /api/photos/upload/bulk
// requires: uploadMultiplePhotos + pushMultiplePhotosToS3 middlewares
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/photos/upload/bulk:
 *   post:
 *     summary: Bulk upload portfolio photos (max 10)
 *     tags: [Photos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photos, category]
 *             properties:
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               category:
 *                 type: string
 *                 enum: [wedding, portrait, commercial, nature, street]
 *     responses:
 *       201:
 *         description: Photos uploaded successfully
 */
const uploadPhotoBulk = async (req, res, next) => {
  try {
    // req.uploadedFiles = [{ key, url }] — set by pushMultiplePhotosToS3
    const photosData = prepareManyPhotoData(
      req.uploadedFiles,
      req.files,
      req.body,
    );

    const photos = await Photo.insertMany(photosData);

    // invalidate photo caches
    await invalidatePhotoCache();

    console.log(
      `✅ Bulk upload → ${photos.length} photos | category: ${req.body.category}`,
    );

    return sendSuccess(
      res,
      STATUS.CREATED,
      `${photos.length} photos uploaded successfully`,
      photos,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// UPDATE PHOTO
// PATCH /api/photos/:id
// update title, description, isFeatured, displayOrder
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/photos/{id}:
 *   patch:
 *     summary: Update photo metadata
 *     tags: [Photos]
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
 *               title: { type: string }
 *               description: { type: string }
 *               isFeatured: { type: boolean }
 *               displayOrder: { type: integer }
 *     responses:
 *       200:
 *         description: Photo updated
 *       404:
 *         description: Photo not found
 */
const updatePhoto = async (req, res, next) => {
  try {
    const allowedUpdates = [
      "title",
      "description",
      "isFeatured",
      "displayOrder",
      "category",
      "tags",
    ];
    const updateData = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const photo = await Photo.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!photo) {
      return next(new AppError("Photo not found", STATUS.NOT_FOUND));
    }

    await invalidatePhotoCache();

    return sendSuccess(res, STATUS.OK, "Photo updated successfully", photo);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE PHOTO
// DELETE /api/photos/:id
// deletes from S3 + MongoDB + invalidates cache
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/photos/{id}:
 *   delete:
 *     summary: Delete a photo
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Photo deleted
 *       404:
 *         description: Photo not found
 */
const deletePhoto = async (req, res, next) => {
  try {
    const photo = await Photo.findById(req.params.id);

    if (!photo) {
      return next(new AppError("Photo not found", STATUS.NOT_FOUND));
    }

    const category = photo.category;

    // 1. delete from S3
    await deletePhotoFromS3(photo.s3Key);

    // 2. delete from MongoDB
    await photo.deleteOne();

    // 3. invalidate cache for this category
    await invalidatePhotoCategoryCache(category);

    console.log(`🗑️  Photo deleted → ${req.params.id}`);

    return sendSuccess(res, STATUS.OK, "Photo deleted successfully");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// BULK DELETE PHOTOS
// DELETE /api/photos/bulk
// body: { ids: ["id1", "id2"] }
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/photos/bulk:
 *   delete:
 *     summary: Bulk delete photos
 *     tags: [Photos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Photos deleted
 */
const deletePhotoBulk = async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return next(
        new AppError(
          "Please provide an array of photo IDs",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // fetch all photos to get S3 keys
    const photos = await Photo.find({ _id: { $in: ids } });

    if (photos.length === 0) {
      return next(
        new AppError("No photos found for provided IDs", STATUS.NOT_FOUND),
      );
    }

    // 1. delete all from S3 in parallel
    const s3Keys = photos.map((p) => p.s3Key);
    await deleteManyPhotosFromS3(s3Keys);

    // 2. delete all from MongoDB
    await Photo.deleteMany({ _id: { $in: ids } });

    // 3. invalidate all photo caches
    await invalidatePhotoCache();

    console.log(`🗑️  Bulk delete → ${photos.length} photos`);

    return sendSuccess(
      res,
      STATUS.OK,
      `${photos.length} photos deleted successfully`,
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPhotos,
  getFeaturedPhotos,
  getPhotosByCategory,
  getPhotoById,
  uploadPhoto,
  uploadPhotoBulk,
  updatePhoto,
  deletePhoto,
  deletePhotoBulk,
};
