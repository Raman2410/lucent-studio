"use strict";

const {
  uploadToS3,
  uploadManyToS3,
  deleteFromS3,
  deleteManyFromS3,
  getPresignedUrl,
  extractKeyFromUrl,
  S3_FOLDERS,
} = require("../config/aws");
const {
  cacheDelete,
  cacheDeletePattern,
  CACHE_KEYS,
} = require("../config/redis");
const { AppError } = require("../middlewares/error.middleware");
const { STATUS } = require("../utils/apiResponse");

// ─────────────────────────────────────────
// PHOTO SERVICE
// portfolio image operations
// coordinates S3 + MongoDB + Redis cache
// ─────────────────────────────────────────

/**
 * Upload a single portfolio photo to S3
 * Called after multer + pushSinglePhotoToS3 middleware
 * req.uploadedFile already has { key, url }
 *
 * @param {object} uploadedFile — { key, url } from upload middleware
 * @param {object} file         — multer file object for metadata
 * @param {object} body         — request body { category, title, description, isFeatured }
 * @returns {object} data to save as Photo document
 */
const preparePhotoData = (uploadedFile, file, body) => {
  return {
    url: uploadedFile.url,
    s3Key: uploadedFile.key,
    category: body.category,
    title: body.title || "",
    description: body.description || "",
    isFeatured: body.isFeatured === "true" || body.isFeatured === true,
    displayOrder: parseInt(body.displayOrder) || 0,
    // multipart form fields arrive as strings — accept a comma-separated
    // list, e.g. "mountain, landscape", and normalize into an array.
    // Photo.model.js's setter lowercases/trims each tag on save.
    tags: body.tags
      ? String(body.tags)
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    originalName: file.originalname,
    fileSizeBytes: file.size,
    mimeType: file.mimetype,
  };
};

/**
 * Prepare multiple photo data objects for bulk insert
 * @param {Array} uploadedFiles — [{ key, url }] from upload middleware
 * @param {Array} files         — multer files array
 * @param {object} body         — request body { category }
 * @returns {Array} array of photo data objects
 */
const prepareManyPhotoData = (uploadedFiles, files, body) => {
  return uploadedFiles.map((uploadedFile, index) => ({
    url: uploadedFile.url,
    s3Key: uploadedFile.key,
    category: body.category,
    title: body.titles?.[index] || "",
    description: body.descriptions?.[index] || "",
    isFeatured: false, // bulk uploads not featured by default
    displayOrder: parseInt(body.startOrder || 0) + index,
    originalName: files[index].originalname,
    fileSizeBytes: files[index].size,
    mimeType: files[index].mimetype,
  }));
};

/**
 * Delete a photo from S3 by its S3 key or URL
 * Handles both key format and full URL format
 * @param {string} s3KeyOrUrl — S3 key or full S3 URL
 */
const deletePhotoFromS3 = async (s3KeyOrUrl) => {
  try {
    const key = s3KeyOrUrl.startsWith("https://")
      ? extractKeyFromUrl(s3KeyOrUrl)
      : s3KeyOrUrl;

    await deleteFromS3(key);
  } catch (error) {
    console.error("❌ S3 photo delete error:", error.message);
    throw new AppError(
      "Failed to delete photo from storage",
      STATUS.INTERNAL_ERROR,
    );
  }
};

/**
 * Delete multiple photos from S3 in parallel
 * @param {Array<string>} s3Keys — array of S3 keys
 */
const deleteManyPhotosFromS3 = async (s3Keys) => {
  try {
    const keys = s3Keys.map((k) =>
      k.startsWith("https://") ? extractKeyFromUrl(k) : k,
    );
    await deleteManyFromS3(keys);
  } catch (error) {
    console.error("❌ S3 bulk photo delete error:", error.message);
    throw new AppError(
      "Failed to delete photos from storage",
      STATUS.INTERNAL_ERROR,
    );
  }
};

// ─────────────────────────────────────────
// CAMERA IMAGE SERVICE
// camera + accessories image operations
// ─────────────────────────────────────────

/**
 * Prepare camera data with uploaded image info
 * Called after pushCameraWithAccessoriesToS3 middleware
 *
 * @param {object} uploadedCameraImage      — { key, url }
 * @param {Array}  uploadedAccessoryImages  — [{ key, url }]
 * @param {object} body                     — request body
 * @returns {object} camera data ready for DB save
 */
const prepareCameraData = (
  uploadedCameraImage,
  uploadedAccessoryImages = [],
  body,
) => {
  // parse accessories from request body
  // body.accessories is JSON string array
  let accessories = [];
  try {
    accessories = body.accessories ? JSON.parse(body.accessories) : [];
  } catch {
    accessories = [];
  }

  // merge uploaded accessory images with accessory data
  const accessoriesWithImages = accessories.map((acc, index) => ({
    name: acc.name || "",
    description: acc.description || "",
    additionalCharge: parseInt(acc.additionalCharge) || 0,
    isAvailable: true,
    image: uploadedAccessoryImages[index]
      ? {
          url: uploadedAccessoryImages[index].url,
          s3Key: uploadedAccessoryImages[index].key,
        }
      : { url: "", s3Key: "" },
  }));

  return {
    name: body.name,
    brand: body.brand,
    model: body.model,
    description: body.description || "",
    image: {
      url: uploadedCameraImage.url,
      s3Key: uploadedCameraImage.key,
    },
    specs: {
      sensorType: body.sensorType || "",
      megapixels: parseFloat(body.megapixels) || null,
      videoResolution: body.videoResolution || "",
      isoRange: body.isoRange || "",
      autofocusPoints: parseInt(body.autofocusPoints) || null,
      batteryLife: body.batteryLife || "",
      bodyType: body.bodyType || "Mirrorless",
      mountType: body.mountType || "",
    },
    rentalRates: {
      hourly: parseFloat(body.hourlyRate),
      daily: parseFloat(body.dailyRate),
      weekend: parseFloat(body.weekendRate),
    },
    accessories: accessoriesWithImages,
    photographerAddon: {
      available: body.photographerAddonAvailable !== "false",
      chargePerHour: parseFloat(body.photographerChargePerHour) || 500,
    },
    rentalTerms: {
      securityDeposit: parseFloat(body.securityDeposit) || 5000,
      idProofRequired: body.idProofRequired !== "false",
      notes: body.rentalNotes || "",
    },
    displayOrder: parseInt(body.displayOrder) || 0,
  };
};

/**
 * Delete camera image + all accessory images from S3
 * Called when camera is deleted from DB
 * @param {object} camera — Camera mongoose document
 */
const deleteCameraImages = async (camera) => {
  const keysToDelete = [];

  // main camera image
  if (camera.image?.s3Key) {
    keysToDelete.push(camera.image.s3Key);
  }

  // accessory images
  camera.accessories?.forEach((acc) => {
    if (acc.image?.s3Key) {
      keysToDelete.push(acc.image.s3Key);
    }
  });

  if (keysToDelete.length > 0) {
    await deleteManyFromS3(keysToDelete);
    console.log(
      `🗑️  Deleted ${keysToDelete.length} S3 image(s) for camera: ${camera.name}`,
    );
  }
};

// ─────────────────────────────────────────
// CACHE INVALIDATION HELPERS
// called after any DB write to keep
// Redis cache in sync with MongoDB
// ─────────────────────────────────────────

/**
 * Invalidate all photo caches
 * Called after any photo create/update/delete
 */
const invalidatePhotoCache = async () => {
  await cacheDelete(CACHE_KEYS.allPhotos);
  await cacheDeletePattern("photos:category:*");
  console.log("🗑️  Photo cache invalidated");
};

/**
 * Invalidate photo cache for a specific category
 * @param {string} category
 */
const invalidatePhotoCategoryCache = async (category) => {
  await cacheDelete(CACHE_KEYS.photosByCategory(category));
  await cacheDelete(CACHE_KEYS.allPhotos);
  console.log(`🗑️  Photo cache invalidated for category: ${category}`);
};

/**
 * Invalidate all camera caches
 * Called after any camera create/update/delete
 */
const invalidateCameraCache = async () => {
  await cacheDelete(CACHE_KEYS.allCameras);
  console.log("🗑️  Camera cache invalidated");
};

/**
 * Invalidate all package caches
 * Called after any package create/update/delete
 */
const invalidatePackageCache = async () => {
  await cacheDelete(CACHE_KEYS.allPackages);
  await cacheDeletePattern("packages:category:*");
  console.log("🗑️  Package cache invalidated");
};

module.exports = {
  // photo operations
  preparePhotoData,
  prepareManyPhotoData,
  deletePhotoFromS3,
  deleteManyPhotosFromS3,

  // camera operations
  prepareCameraData,
  deleteCameraImages,

  // cache invalidation
  invalidatePhotoCache,
  invalidatePhotoCategoryCache,
  invalidateCameraCache,
  invalidatePackageCache,

  // re-export S3_FOLDERS for convenience
  S3_FOLDERS,
};
