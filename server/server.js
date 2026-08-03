"use strict";

// ─────────────────────────────────────────
// LOAD ENVIRONMENT VARIABLES FIRST
// before anything else is imported
// ─────────────────────────────────────────
const path = require("path");
const dotenv = require("dotenv");
const { startReminderScheduler } = require("./src/services/email.service");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : process.env.NODE_ENV === "test"
      ? ".env.development" // use dev DB for tests (overridden in setup.js)
      : ".env.development";

dotenv.config({ path: path.resolve(__dirname, envFile) });

// ─────────────────────────────────────────
// VALIDATE REQUIRED ENV KEYS ON STARTUP
// app crashes immediately if any key missing
// ─────────────────────────────────────────
const REQUIRED_ENV_KEYS = [
  "NODE_ENV",
  "PORT",
  "MONGO_URI",
  "REDIS_HOST",
  "REDIS_PORT",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "JWT_COOKIE_EXPIRES_IN",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_BUCKET_NAME",
  "AWS_REGION",
  "SMTP_EMAIL",
  "SMTP_PASSWORD",
  "EMAIL_FROM",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "CLIENT_URL",
  "RATE_LIMIT_WINDOW_MS",
  "RATE_LIMIT_MAX",
];

const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]);

if (missingKeys.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingKeys.forEach((key) => console.error(`   - ${key}`));
  console.error("💡 Check .env.example for reference.");
  process.exit(1);
}

// ─────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────
const http = require("http");
const { Server } = require("socket.io");

const app = require("./src/app");
const connectDB = require("./src/config/db");
const {connectRedis} = require("./src/config/redis");
const { registerSocketEvents } = require("./src/socket");

// ─────────────────────────────────────────
// HTTP SERVER + SOCKET.IO SETUP
// ─────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// attach io instance to app so controllers can emit events
app.set("io", io);

// register all socket events
registerSocketEvents(io);

// ─────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. connect to MongoDB
    await connectDB();

    // 2. connect to Redis
    await connectRedis();

    startReminderScheduler();

    // 3. start HTTP + WebSocket server
    httpServer.listen(PORT, () => {
      console.log("─────────────────────────────────────────");
      console.log(`✅ Server running in ${process.env.NODE_ENV} mode`);
      console.log(`🚀 HTTP   → http://localhost:${PORT}`);
      console.log(`📡 Socket → ws://localhost:${PORT}`);
      console.log(`📖 Docs   → http://localhost`);
      console.log("─────────────────────────────────────────");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

// ─────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────
process.on("SIGTERM", () => {
  console.log("⚠️  SIGTERM received. Shutting down gracefully...");
  httpServer.close(() => {
    console.log("✅ HTTP server closed.");
    process.exit(0);
  });
});

// ─────────────────────────────────────────
// UNHANDLED ERRORS — crash loudly in dev,
// graceful shutdown in production
// ─────────────────────────────────────────
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
  httpServer.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  process.exit(1);
});
