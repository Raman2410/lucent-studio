"use strict";

jest.mock("razorpay");
jest.mock("nodemailer");

jest.setTimeout(20000); 
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// ─────────────────────────────────────────
// LOAD ENV VARS BEFORE ANYTHING ELSE
// server.js normally does this, but tests never run server.js —
// they require("../src/app") directly, and app.js itself doesn't
// call dotenv.config(). Without this, every env var (RAZORPAY_KEY_ID,
// JWT_SECRET, etc.) is undefined the instant app.js pulls in
// booking.routes.js -> razorpay.service.js -> config/razorpay.js,
// which crashes on module load with "`key_id` or `oauthToken` is
// mandatory" — before a single test even runs.
//
// dotenv.config() does NOT override variables already present in
// process.env (its default), so this plays nicely with CI, where
// ci-cd.yml sets these directly as job-level env vars.
// ─────────────────────────────────────────
dotenv.config({ path: path.resolve(__dirname, "../.env.development") });

// ─────────────────────────────────────────
// TEST ENVIRONMENT SETUP
// runs before all test suites
// uses real MongoDB connection with a
// separate test database — no mocking
// ─────────────────────────────────────────

// ── Override MONGO_URI for tests ──────────
// uses test database to keep dev data clean
const TEST_MONGO_URI =
  process.env.MONGO_URI?.replace(/\/[^/]+(\?|$)/, "/photographer_test$1") ||
  "mongodb://localhost:27017/photographer_test";

// ── Override Redis for tests ──────────────
// disable Redis caching in tests
// prevents test interference via cached data
process.env.REDIS_HOST = "localhost";
process.env.REDIS_PORT = "6379";

// ─────────────────────────────────────────
// GLOBAL TEST HELPERS
// available in all test files without import
// ─────────────────────────────────────────

// test user credentials
global.TEST_USER = {
  name: "Test User",
  email: "test@photographer.com",
  password: "Test@1234",
  phone: "9876543210",
};

global.TEST_USER_2 = {
  name: "Another User",
  email: "another@photographer.com",
  password: "Test@1234",
  phone: "9876543211",
};

// ─────────────────────────────────────────
// JEST LIFECYCLE HOOKS
// ─────────────────────────────────────────

// connect to test DB before all tests
beforeAll(async () => {
  try {
    await mongoose.connect(TEST_MONGO_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ Test DB connected → ${TEST_MONGO_URI}`);
  } catch (error) {
    console.error("❌ Test DB connection failed:", error.message);
    throw error;
  }
});

// clean all collections before each test
// ensures test isolation — no data leaks between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// disconnect after all tests complete
afterAll(async () => {
  await mongoose.connection.close();
  console.log("✅ Test DB disconnected");
});

// ─────────────────────────────────────────
// GLOBAL UTILITIES
// helper functions used across test files
// ─────────────────────────────────────────

const request = require("supertest");
const app = require("../src/app");

/**
 * Register a user and return token + user data
 * @param {object} userData — optional override
 * @returns {{ token, user }}
 */
global.registerAndLogin = async (userData = global.TEST_USER) => {
  const res = await request(app).post("/api/auth/register").send(userData);

  return {
    token: res.body.token,
    user: res.body.data?.user,
    res,
  };
};

/**
 * Register a user, promote to "admin" directly in the DB, then log
 * back in so the returned token carries the admin role. Needed for
 * routes gated with restrictTo("admin"), e.g. availability block/unblock.
 * @param {object} userData — optional override
 * @returns {{ token, user }}
 */
global.registerAndLoginAdmin = async (userData = global.TEST_USER) => {
  const User = require("../src/models/User.model");

  await request(app).post("/api/auth/register").send(userData);
  await User.findOneAndUpdate({ email: userData.email }, { role: "admin" });

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: userData.email, password: userData.password });

  return {
    token: loginRes.body.token,
    user: loginRes.body.data?.user,
    res: loginRes,
  };
};

/**
 * Login existing user and return token
 * @param {string} email
 * @param {string} password
 * @returns {{ token }}
 */
global.loginUser = async (email, password) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return {
    token: res.body.token,
    res,
  };
};

/**
 * Create a test package in DB directly
 * @param {object} overrides
 * @returns {object} package document
 */
global.createTestPackage = async (overrides = {}) => {
  const Package = require("../src/models/Package.model");
  return Package.create({
    name: "Test Wedding Package",
    tagline: "Perfect for your big day",
    category: "wedding",
    type: "fixed",
    price: { amount: 25000, currency: "INR", unit: "per session" },
    description: "A comprehensive wedding photography package",
    includes: ["8 hours coverage", "500 edited photos", "Online gallery"],
    duration: { value: 8, unit: "hours" },
    deliverables: {
      editedPhotos: 500,
      onlineGallery: true,
      turnaroundDays: 14,
    },
    isPopular: true,
    displayOrder: 1,
    ...overrides,
  });
};

/**
 * Create a test camera in DB directly
 * @param {object} overrides
 * @returns {object} camera document
 */
global.createTestCamera = async (overrides = {}) => {
  const Camera = require("../src/models/Camera.model");
  return Camera.create({
    name: "Alpha A7 III",
    brand: "Sony",
    model: "A7 III",
    description: "Professional full-frame mirrorless camera",
    image: {
      url: "https://test-bucket.s3.ap-south-1.amazonaws.com/cameras/test.jpg",
      s3Key: "cameras/test.jpg",
    },
    specs: {
      sensorType: "Full Frame",
      megapixels: 24.2,
      videoResolution: "4K 30fps",
      bodyType: "Mirrorless",
    },
    rentalRates: {
      hourly: 500,
      daily: 3000,
      weekend: 5000,
    },
    rentalTerms: {
      securityDeposit: 5000,
      idProofRequired: true,
    },
    isAvailable: true,
    displayOrder: 1,
    ...overrides,
  });
};

/**
 * Create a test booking in DB directly
 * @param {string} userId
 * @param {string} packageId
 * @param {object} overrides
 * @returns {object} booking document
 */
global.createTestBooking = async (userId, packageId, overrides = {}) => {
  const Booking = require("../src/models/Booking.model");

  // use a date 7 days from now
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);

  return Booking.create({
    user: userId,
    type: "photography",
    package: packageId,
    packageSnapshot: {
      name: "Test Wedding Package",
      category: "wedding",
      type: "fixed",
      includes: ["8 hours coverage"],
      duration: { value: 8, unit: "hours" },
    },
    date: futureDate,
    time: "10:00",
    location: "Mumbai",
    amount: {
      subtotal: 25000,
      total: 25000,
      currency: "INR",
    },
    status: "Pending",
    ...overrides,
  });
};

/**
 * Create a test rental booking in DB directly
 * @param {string} userId
 * @param {string} cameraId
 * @param {object} overrides
 * @returns {object} booking document
 */
global.createTestRentalBooking = async (userId, cameraId, overrides = {}) => {
  const Booking = require("../src/models/Booking.model");

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);

  return Booking.create({
    user: userId,
    type: "rental",
    camera: cameraId,
    cameraSnapshot: {
      name: "Alpha A7 III",
      brand: "Sony",
      model: "A7 III",
      imageUrl: "https://test-bucket.s3.ap-south-1.amazonaws.com/cameras/test.jpg",
      dailyRate: 3000,
    },
    rentalType: "daily",
    rentalQuantity: 1,
    date: futureDate,
    time: "09:00",
    amount: {
      subtotal: 3000,
      securityDeposit: 5000,
      total: 8000,
      currency: "INR",
    },
    status: "Pending",
    ...overrides,
  });
};

/**
 * Auth header helper
 * @param {string} token
 * @returns {object} Authorization header object
 */
global.authHeader = (token) => ({
  Authorization: `Bearer ${token}`,
});
