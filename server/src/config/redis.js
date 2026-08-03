"use strict";

const Redis = require("ioredis");

// ─────────────────────────────────────────
// REDIS CLIENT INSTANCE
// ─────────────────────────────────────────
let redisClient = null;

const createRedisClient = () => {
  const client = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD || undefined,
    family: 4, // IPv4
    maxRetriesPerRequest: 3, // retry failed commands 3 times
    enableReadyCheck: true, // wait until Redis is truly ready
    lazyConnect: true, // don't auto-connect on creation
    retryStrategy: (times) => {
      // exponential backoff — 200ms, 400ms, 800ms ... max 5s
      const delay = Math.min(times * 200, 5000);
      console.log(`🔄 Redis retry attempt ${times} in ${delay}ms...`);
      return delay;
    },
  });

  // ─────────────────────────────────────────
  // REDIS EVENT LISTENERS
  // ─────────────────────────────────────────
  client.on("connect", () => {
    console.log("✅ Redis connected →", process.env.REDIS_HOST);
  });

  client.on("ready", () => {
    console.log("✅ Redis ready to accept commands.");
  });

  client.on("error", (err) => {
    console.error("❌ Redis error:", err.message);
  });

  client.on("close", () => {
    console.warn("⚠️  Redis connection closed.");
  });

  client.on("reconnecting", () => {
    console.log("🔄 Redis reconnecting...");
  });

  client.on("end", () => {
    console.warn("⚠️  Redis connection ended.");
  });

  return client;
};

// ─────────────────────────────────────────
// CONNECT FUNCTION — called in server.js
// ─────────────────────────────────────────
const connectRedis = async () => {
  try {
    redisClient = createRedisClient();
    await redisClient.connect();
    console.log(`   Host: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
  } catch (error) {
    console.error("❌ Redis connection failed:", error.message);
    // Redis failure is non-fatal — app runs without cache
    // availability calendar will fall back to MongoDB
    console.warn("⚠️  Running without Redis cache. Falling back to MongoDB.");
  }
};

// ─────────────────────────────────────────
// GETTER — use this in services/controllers
// ─────────────────────────────────────────
const getRedisClient = () => redisClient;

// ─────────────────────────────────────────
// CACHE HELPERS — cache-aside pattern
// ─────────────────────────────────────────

/**
 * Get a value from Redis cache
 * @param {string} key
 * @returns {any|null} parsed value or null if not found
 */
const cacheGet = async (key) => {
  try {
    if (!redisClient) return null;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`❌ Redis GET error [${key}]:`, error.message);
    return null; // fail silently — fallback to DB
  }
};

/**
 * Set a value in Redis cache
 * @param {string} key
 * @param {any} value — will be JSON stringified
 * @param {number} ttlSeconds — time to live in seconds (default: 1 hour)
 */
const cacheSet = async (key, value, ttlSeconds = 3600) => {
  try {
    if (!redisClient) return;
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error(`❌ Redis SET error [${key}]:`, error.message);
    // fail silently — data still served from DB
  }
};

/**
 * Delete a single key from Redis cache
 * @param {string} key
 */
const cacheDelete = async (key) => {
  try {
    if (!redisClient) return;
    await redisClient.del(key);
  } catch (error) {
    console.error(`❌ Redis DEL error [${key}]:`, error.message);
  }
};

/**
 * Delete all keys matching a pattern
 * Used to invalidate availability cache when booking changes
 * @param {string} pattern — e.g. "availability:*"
 */
const cacheDeletePattern = async (pattern) => {
  try {
    if (!redisClient) return;

    // SCAN is non-blocking unlike KEYS — safe for production
    let cursor = "0";
    do {
      const result = await redisClient.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        await redisClient.del(...keys);
        console.log(
          `🗑️  Invalidated ${keys.length} cache keys matching: ${pattern}`,
        );
      }
    } while (cursor !== "0");
  } catch (error) {
    console.error(`❌ Redis pattern delete error [${pattern}]:`, error.message);
  }
};

/**
 * Check if Redis is connected and ready
 * @returns {boolean}
 */
const isRedisReady = () => {
  return redisClient && redisClient.status === "ready";
};

// ─────────────────────────────────────────
// CACHE KEY CONSTANTS
// centralised — no magic strings in controllers
// ─────────────────────────────────────────
const CACHE_KEYS = {
  availability: (month) => `availability:${month}`, // e.g. availability:2024-08
  allPhotos: "photos:all",
  photosByCategory: (cat) => `photos:category:${cat}`,
  allPackages: "packages:all",
  packagesByCategory: (cat) => `packages:category:${cat}`,
  allCameras: "cameras:all",
};

// TTL CONSTANTS (in seconds)
const CACHE_TTL = {
  availability: 60 * 60, // 1 hour  — invalidated on booking change
  photos: 60 * 60 * 6, // 6 hours — photos don't change often
  packages: 60 * 60 * 12, // 12 hours
  cameras: 60 * 60 * 6, // 6 hours
};

// ─────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────
process.on("SIGINT", async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log("✅ Redis connection closed on app termination.");
  }
});

module.exports = {
  connectRedis,
  getRedisClient,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  isRedisReady,
  CACHE_KEYS,
  CACHE_TTL,
};
