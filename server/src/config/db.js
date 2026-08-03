"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────
// MONGOOSE GLOBAL SETTINGS
// ─────────────────────────────────────────
mongoose.set("strictQuery", true); // suppress deprecation warning

// ─────────────────────────────────────────
// CONNECTION OPTIONS
// ─────────────────────────────────────────
const MONGO_OPTIONS = {
  maxPoolSize: 10, // max 10 simultaneous connections in pool
  serverSelectionTimeoutMS: 5000, // timeout if no server found in 5s
  socketTimeoutMS: 45000, // close socket after 45s inactivity
  family: 4, // use IPv4, skip IPv6
};

// ─────────────────────────────────────────
// RETRY LOGIC
// ─────────────────────────────────────────
const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000; // 5 seconds between retries

let retryCount = 0;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);

    console.log(`✅ MongoDB connected → ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);

    retryCount = 0; // reset on successful connection
  } catch (error) {
    retryCount++;
    console.error(
      `❌ MongoDB connection failed (attempt ${retryCount}/${MAX_RETRIES}): ${error.message}`,
    );

    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      return connectDB(); // recursive retry
    } else {
      console.error("❌ Max retries reached. Exiting process.");
      process.exit(1);
    }
  }
};

// ─────────────────────────────────────────
// MONGOOSE CONNECTION EVENT LISTENERS
// ─────────────────────────────────────────

// fires when mongoose loses connection after initially connecting
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected. Attempting to reconnect...");
});

// fires when mongoose successfully reconnects
mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconnected.");
});

// fires on connection error after initial connect
mongoose.connection.on("error", (err) => {
  console.error(`❌ MongoDB connection error: ${err.message}`);
});

// ─────────────────────────────────────────
// GRACEFUL DISCONNECT ON APP SHUTDOWN
// ─────────────────────────────────────────
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("✅ MongoDB connection closed on app termination.");
  process.exit(0);
});

module.exports = connectDB;
