"use strict";

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");
const path = require("path");

// ─────────────────────────────────────────
// S3 CLIENT INSTANCE
// ─────────────────────────────────────────
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ─────────────────────────────────────────
// S3 FOLDER STRUCTURE
// keeps bucket organised
// ─────────────────────────────────────────
const S3_FOLDERS = {
  portfolio: "portfolio", // photographer portfolio images
  cameras: "cameras", // camera rental product images
  accessories: "accessories", // camera accessories images
};

// ─────────────────────────────────────────
// ALLOWED FILE TYPES
// ─────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

/**
 * Generate a unique S3 key for a file
 * Format: folder/timestamp-randomhex.ext
 * e.g. portfolio/1720000000000-a3f2b1c4.jpg
 * @param {string} folder — one of S3_FOLDERS values
 * @param {string} originalName — original file name
 * @returns {string} unique S3 key
 */
const generateS3Key = (folder, originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  const randomHex = crypto.randomBytes(8).toString("hex");
  const timestamp = Date.now();
  return `${folder}/${timestamp}-${randomHex}${ext}`;
};

/**
 * Validate file before upload
 * @param {object} file — multer file object
 * @throws {Error} if file is invalid
 */
const validateFile = (file) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(
      `Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP`,
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 10MB`,
    );
  }
};

// ─────────────────────────────────────────
// UPLOAD FILE TO S3
// ─────────────────────────────────────────

/**
 * Upload a single file buffer to S3
 * @param {object} file — multer file object { buffer, mimetype, originalname, size }
 * @param {string} folder — S3_FOLDERS key e.g. "portfolio"
 * @returns {object} { key, url }
 */
const uploadToS3 = async (file, folder) => {
  // validate first
  validateFile(file);

  const key = generateS3Key(folder, file.originalname);

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    // no ACL — use bucket policy for public read
    Metadata: {
      originalName: file.originalname,
      uploadedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);

  // construct public URL
  const url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  console.log(`✅ S3 upload success → ${key}`);

  return { key, url };
};

/**
 * Upload multiple files to S3 in parallel
 * @param {Array} files — array of multer file objects
 * @param {string} folder — S3_FOLDERS key
 * @returns {Array} array of { key, url }
 */
const uploadManyToS3 = async (files, folder) => {
  const uploads = files.map((file) => uploadToS3(file, folder));
  return Promise.all(uploads);
};

// ─────────────────────────────────────────
// DELETE FILE FROM S3
// ─────────────────────────────────────────

/**
 * Delete a single file from S3 by key
 * @param {string} key — S3 object key e.g. "portfolio/1720000000000-a3f2b1c4.jpg"
 */
const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`🗑️  S3 delete success → ${key}`);
  } catch (error) {
    console.error(`❌ S3 delete error [${key}]:`, error.message);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
};

/**
 * Delete multiple files from S3 in parallel
 * @param {Array<string>} keys — array of S3 object keys
 */
const deleteManyFromS3 = async (keys) => {
  const deletions = keys.map((key) => deleteFromS3(key));
  return Promise.all(deletions);
};

// ─────────────────────────────────────────
// GENERATE PRE-SIGNED URL
// for temporary private file access
// ─────────────────────────────────────────

/**
 * Generate a pre-signed URL for temporary access to a private S3 object
 * Useful for client galleries or private deliverables
 * @param {string} key — S3 object key
 * @param {number} expiresInSeconds — default: 1 hour
 * @returns {string} pre-signed URL
 */
const getPresignedUrl = async (key, expiresInSeconds = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return url;
  } catch (error) {
    console.error(`❌ S3 presigned URL error [${key}]:`, error.message);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
};

/**
 * Extract S3 key from a full S3 URL
 * e.g. "https://bucket.s3.region.amazonaws.com/portfolio/file.jpg"
 *   →  "portfolio/file.jpg"
 * @param {string} url — full S3 URL
 * @returns {string} S3 key
 */
const extractKeyFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    // pathname starts with "/" — remove leading slash
    return urlObj.pathname.slice(1);
  } catch {
    return url; // assume it's already a key
  }
};

module.exports = {
  s3Client,
  S3_FOLDERS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  uploadToS3,
  uploadManyToS3,
  deleteFromS3,
  deleteManyFromS3,
  getPresignedUrl,
  extractKeyFromUrl,
};
