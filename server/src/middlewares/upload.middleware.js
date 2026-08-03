"use strict";

const multer = require("multer");
const {
  uploadToS3,
  uploadManyToS3,
  S3_FOLDERS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} = require("../config/aws");
const { AppError } = require("./error.middleware");
const { STATUS } = require("../utils/apiResponse");

// ─────────────────────────────────────────
// MULTER STORAGE — memory storage
// files stored as Buffer in req.file.buffer
// we push the buffer directly to S3
// no temp files written to disk
// ─────────────────────────────────────────
const memoryStorage = multer.memoryStorage();

// ─────────────────────────────────────────
// FILE FILTER
// rejects non-image files before they hit S3
// ─────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true); // accept file
  } else {
    cb(
      new AppError(
        `Invalid file type: ${file.mimetype}. Only JPEG, PNG, and WEBP are allowed.`,
        STATUS.BAD_REQUEST,
      ),
      false, // reject file
    );
  }
};

// ─────────────────────────────────────────
// BASE MULTER INSTANCE
// ─────────────────────────────────────────
const upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 10MB per file
    files: 10, // max 10 files per request
  },
});

// ─────────────────────────────────────────
// UPLOAD PRESETS
// named multer configurations for each route
// ─────────────────────────────────────────

// single photo upload — for portfolio images
const uploadSinglePhoto = upload.single("photo");

// multiple photo upload — up to 10 portfolio images at once
const uploadMultiplePhotos = upload.array("photos", 10);

// camera product image — single image
const uploadCameraImage = upload.single("image");

// camera with accessories images — mixed fields
const uploadCameraWithAccessories = upload.fields([
  { name: "image", maxCount: 1 }, // main camera image
  { name: "accessories", maxCount: 5 }, // accessory images
]);

// ─────────────────────────────────────────
// S3 UPLOAD PIPELINE MIDDLEWARES
// these run AFTER multer — take the buffer
// from req.file and push it to S3
// attach { key, url } back to req for controller
// ─────────────────────────────────────────

/**
 * Upload single photo to S3 (portfolio)
 * Attaches req.uploadedFile = { key, url }
 */
const pushSinglePhotoToS3 = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError("No file uploaded.", STATUS.BAD_REQUEST));
    }

    const result = await uploadToS3(req.file, S3_FOLDERS.portfolio);
    req.uploadedFile = result; // { key, url }
    next();
  } catch (error) {
    next(new AppError(error.message, STATUS.INTERNAL_ERROR));
  }
};

/**
 * Upload multiple photos to S3 (portfolio bulk upload)
 * Attaches req.uploadedFiles = [{ key, url }, ...]
 */
const pushMultiplePhotosToS3 = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next(new AppError("No files uploaded.", STATUS.BAD_REQUEST));
    }

    const results = await uploadManyToS3(req.files, S3_FOLDERS.portfolio);
    req.uploadedFiles = results; // [{ key, url }, ...]
    next();
  } catch (error) {
    next(new AppError(error.message, STATUS.INTERNAL_ERROR));
  }
};

/**
 * Upload camera image to S3
 * Attaches req.uploadedFile = { key, url }
 */
const pushCameraImageToS3 = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(
        new AppError("Camera image is required.", STATUS.BAD_REQUEST),
      );
    }

    const result = await uploadToS3(req.file, S3_FOLDERS.cameras);
    req.uploadedFile = result; // { key, url }
    next();
  } catch (error) {
    next(new AppError(error.message, STATUS.INTERNAL_ERROR));
  }
};

/**
 * Upload camera + accessories images to S3
 * Attaches:
 *   req.uploadedCameraImage     = { key, url }
 *   req.uploadedAccessoryImages = [{ key, url }, ...]
 */
const pushCameraWithAccessoriesToS3 = async (req, res, next) => {
  try {
    const files = req.files || {};

    // upload main camera image
    if (!files.image || files.image.length === 0) {
      return next(
        new AppError("Camera image is required.", STATUS.BAD_REQUEST),
      );
    }

    const cameraImage = await uploadToS3(files.image[0], S3_FOLDERS.cameras);
    req.uploadedCameraImage = cameraImage;

    // upload accessory images if provided
    if (files.accessories && files.accessories.length > 0) {
      const accessoryImages = await uploadManyToS3(
        files.accessories,
        S3_FOLDERS.accessories,
      );
      req.uploadedAccessoryImages = accessoryImages;
    } else {
      req.uploadedAccessoryImages = [];
    }

    next();
  } catch (error) {
    next(new AppError(error.message, STATUS.INTERNAL_ERROR));
  }
};

// ─────────────────────────────────────────
// OPTIONAL UPLOAD MIDDLEWARES
// for update routes where file is optional
// ─────────────────────────────────────────

/**
 * Upload single photo to S3 only if file was provided
 * req.uploadedFile = { key, url } | undefined
 */
const pushOptionalPhotoToS3 = async (req, res, next) => {
  try {
    if (!req.file) {
      req.uploadedFile = null; // no file — controller handles it
      return next();
    }

    const result = await uploadToS3(req.file, S3_FOLDERS.portfolio);
    req.uploadedFile = result;
    next();
  } catch (error) {
    next(new AppError(error.message, STATUS.INTERNAL_ERROR));
  }
};

/**
 * Upload camera image to S3 only if file was provided
 * req.uploadedFile = { key, url } | null
 */
const pushOptionalCameraImageToS3 = async (req, res, next) => {
  try {
    if (!req.file) {
      req.uploadedFile = null;
      return next();
    }

    const result = await uploadToS3(req.file, S3_FOLDERS.cameras);
    req.uploadedFile = result;
    next();
  } catch (error) {
    next(new AppError(error.message, STATUS.INTERNAL_ERROR));
  }
};

// ─────────────────────────────────────────
// MULTER ERROR HANDLER
// catches multer-specific errors before
// they reach the global error handler
// ─────────────────────────────────────────
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(
        new AppError(
          "File too large. Maximum size is 10MB.",
          STATUS.BAD_REQUEST,
        ),
      );
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return next(
        new AppError(
          "Too many files. Maximum 10 files allowed.",
          STATUS.BAD_REQUEST,
        ),
      );
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(
        new AppError(`Unexpected field: ${err.field}`, STATUS.BAD_REQUEST),
      );
    }
    return next(new AppError(err.message, STATUS.BAD_REQUEST));
  }
  next(err); // not a multer error — pass to global handler
};

module.exports = {
  // multer presets
  uploadSinglePhoto,
  uploadMultiplePhotos,
  uploadCameraImage,
  uploadCameraWithAccessories,

  // S3 pipeline middlewares
  pushSinglePhotoToS3,
  pushMultiplePhotosToS3,
  pushCameraImageToS3,
  pushCameraWithAccessoriesToS3,

  // optional upload middlewares
  pushOptionalPhotoToS3,
  pushOptionalCameraImageToS3,

  // error handler
  handleMulterError,
};
