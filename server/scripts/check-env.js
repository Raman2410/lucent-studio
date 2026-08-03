"use strict";

/**
 * check-env.js — validates server/.env.{development,production} before you
 * bother booting Mongo, Redis, and the whole app.
 *
 * Two levels of checking:
 *   1. STATIC  (always runs) — every key server.js requires is present,
 *      and each value is roughly the right shape (right prefix, numeric
 *      where it should be numeric, etc.) so a typo doesn't slip through.
 *   2. LIVE  (only with --live) — actually reaches out to Mongo, Redis,
 *      Gmail SMTP, and S3 to confirm the credentials really work.
 *      Razorpay and Anthropic are skipped in --live mode on purpose —
 *      both would need a real API call that either costs money
 *      (Anthropic) or shows up in a dashboard (Razorpay); format
 *      validation is usually enough to catch a pasted-wrong-key mistake.
 *
 * Usage:
 *   node scripts/check-env.js            # static checks only
 *   node scripts/check-env.js --live     # static + live connectivity
 *   NODE_ENV=production node scripts/check-env.js --live
 */

const path = require("path");
const dotenv = require("dotenv");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";

const envPath = path.resolve(__dirname, "..", envFile);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error(`❌ Could not read ${envFile} at ${envPath}`);
  console.error(`   ${result.error.message}`);
  process.exit(1);
}

const LIVE = process.argv.includes("--live");

console.log(
  `\n🔎 Checking ${envFile}${LIVE ? " (static + live)" : " (static only)"}\n`,
);

// ─────────────────────────────────────────
// 1. PRESENCE — mirrors REQUIRED_ENV_KEYS in server.js
//    (kept in sync manually — update both if you add a new key)
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

const errors = [];
const warnings = [];

const missing = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  missing.forEach((key) => errors.push(`Missing: ${key}`));
}

// ─────────────────────────────────────────
// 2. FORMAT / SHAPE CHECKS
//    only run on keys that are actually present
// ─────────────────────────────────────────
const has = (key) => !!process.env[key];
const val = (key) => process.env[key];

const isNumeric = (s) => /^\d+$/.test(s);
const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

if (
  has("NODE_ENV") &&
  !["development", "production", "test"].includes(val("NODE_ENV"))
) {
  warnings.push(
    `NODE_ENV="${val("NODE_ENV")}" — expected development | production | test`,
  );
}

if (has("PORT") && !isNumeric(val("PORT"))) {
  errors.push(`PORT="${val("PORT")}" is not numeric`);
}

if (has("MONGO_URI") && !/^mongodb(\+srv)?:\/\//.test(val("MONGO_URI"))) {
  errors.push(`MONGO_URI doesn't start with mongodb:// or mongodb+srv://`);
}

if (has("REDIS_PORT") && !isNumeric(val("REDIS_PORT"))) {
  errors.push(`REDIS_PORT="${val("REDIS_PORT")}" is not numeric`);
}

if (has("JWT_SECRET") && val("JWT_SECRET").length < 32) {
  errors.push(
    `JWT_SECRET is only ${val("JWT_SECRET").length} chars — needs 32+`,
  );
}

if (has("JWT_COOKIE_EXPIRES_IN") && !isNumeric(val("JWT_COOKIE_EXPIRES_IN"))) {
  errors.push(
    `JWT_COOKIE_EXPIRES_IN="${val("JWT_COOKIE_EXPIRES_IN")}" should be a plain number of days (e.g. 7)`,
  );
}

if (has("AWS_REGION") && !/^[a-z]{2}-[a-z]+-\d$/.test(val("AWS_REGION"))) {
  warnings.push(
    `AWS_REGION="${val("AWS_REGION")}" doesn't look like a real region (e.g. ap-south-1)`,
  );
}

if (has("SMTP_EMAIL")) {
  if (!looksLikeEmail(val("SMTP_EMAIL"))) {
    errors.push(
      `SMTP_EMAIL="${val("SMTP_EMAIL")}" doesn't look like a valid email`,
    );
  } else if (!val("SMTP_EMAIL").endsWith("@gmail.com")) {
    warnings.push(
      `SMTP_EMAIL isn't a @gmail.com address — nodemailer.js is hardcoded to service: "gmail", so a non-Gmail address will fail auth`,
    );
  }
}

if (
  has("SMTP_PASSWORD") &&
  val("SMTP_PASSWORD").replace(/\s/g, "").length !== 16
) {
  warnings.push(
    `SMTP_PASSWORD isn't 16 characters — make sure this is a Gmail App Password, not your login password`,
  );
}

if (has("EMAIL_FROM") && !/@/.test(val("EMAIL_FROM"))) {
  errors.push(
    `EMAIL_FROM doesn't contain an email address (expected format: "Name <email@domain.com>")`,
  );
}

if (
  has("RAZORPAY_KEY_ID") &&
  !/^rzp_(test|live)_/.test(val("RAZORPAY_KEY_ID"))
) {
  errors.push(`RAZORPAY_KEY_ID doesn't start with rzp_test_ or rzp_live_`);
}

if (
  has("RAZORPAY_KEY_ID") &&
  has("RAZORPAY_KEY_SECRET") &&
  val("RAZORPAY_KEY_ID").startsWith("rzp_live_") &&
  process.env.NODE_ENV !== "production"
) {
  warnings.push(
    `Using a LIVE Razorpay key outside of production — double check this is intentional`,
  );
}

if (
  has("ANTHROPIC_API_KEY") &&
  !val("ANTHROPIC_API_KEY").startsWith("sk-ant-")
) {
  errors.push(`ANTHROPIC_API_KEY doesn't start with sk-ant-`);
}

if (has("CLIENT_URL") && !/^https?:\/\//.test(val("CLIENT_URL"))) {
  errors.push(`CLIENT_URL doesn't start with http:// or https://`);
}

if (has("RATE_LIMIT_WINDOW_MS") && !isNumeric(val("RATE_LIMIT_WINDOW_MS"))) {
  errors.push(
    `RATE_LIMIT_WINDOW_MS="${val("RATE_LIMIT_WINDOW_MS")}" is not numeric`,
  );
}

if (has("RATE_LIMIT_MAX") && !isNumeric(val("RATE_LIMIT_MAX"))) {
  errors.push(`RATE_LIMIT_MAX="${val("RATE_LIMIT_MAX")}" is not numeric`);
}

// ─────────────────────────────────────────
// 3. LIVE CONNECTIVITY CHECKS (--live only)
// ─────────────────────────────────────────
async function runLiveChecks() {
  const liveResults = [];

  // Mongo
  if (has("MONGO_URI")) {
    try {
      const mongoose = require("mongoose");
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      await mongoose.connection.close();
      liveResults.push(["MongoDB", true, ""]);
    } catch (err) {
      liveResults.push(["MongoDB", false, err.message]);
    }
  }

  // Redis
  if (has("REDIS_HOST") && has("REDIS_PORT")) {
    try {
      const Redis = require("ioredis");
      const client = new Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10),
        password: process.env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        connectTimeout: 5000,
        retryStrategy: () => null, // don't retry, fail fast for this check
      });
      await client.connect();
      await client.ping();
      client.disconnect();
      liveResults.push(["Redis", true, ""]);
    } catch (err) {
      liveResults.push([
        "Redis",
        false,
        `${err.message} (non-fatal — app falls back to Mongo without Redis)`,
      ]);
    }
  }

  // Gmail SMTP
  if (has("SMTP_EMAIL") && has("SMTP_PASSWORD")) {
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
      });
      await transporter.verify();
      liveResults.push(["Gmail SMTP", true, ""]);
    } catch (err) {
      liveResults.push(["Gmail SMTP", false, err.message]);
    }
  }

  // S3 — HeadBucket is free and doesn't touch objects
  if (has("AWS_ACCESS_KEY_ID") && has("AWS_BUCKET_NAME")) {
    try {
      const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");
      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      await s3.send(
        new HeadBucketCommand({ Bucket: process.env.AWS_BUCKET_NAME }),
      );
      liveResults.push(["AWS S3", true, ""]);
    } catch (err) {
      liveResults.push(["AWS S3", false, err.message]);
    }
  }

  console.log("── Live connectivity ──────────────────");
  liveResults.forEach(([name, ok, msg]) => {
    console.log(ok ? `✅ ${name}` : `❌ ${name} — ${msg}`);
  });
  console.log(
    "ℹ️  Razorpay and Anthropic are format-checked only, not live-tested (avoids a dashboard entry / API cost).\n",
  );

  return liveResults.every(([, ok]) => ok);
}

// ─────────────────────────────────────────
// REPORT + EXIT
// ─────────────────────────────────────────
(async () => {
  console.log("── Static checks ──────────────────────");
  if (errors.length === 0) {
    console.log(
      `✅ All ${REQUIRED_ENV_KEYS.length} required keys present and well-formed`,
    );
  } else {
    errors.forEach((e) => console.log(`❌ ${e}`));
  }
  warnings.forEach((w) => console.log(`⚠️  ${w}`));
  console.log("");

  let liveOk = true;
  if (LIVE && errors.length === 0) {
    liveOk = await runLiveChecks();
  } else if (LIVE) {
    console.log("⏭️  Skipping live checks — fix static errors first.\n");
  }

  if (errors.length > 0 || (LIVE && !liveOk)) {
    console.log("❌ Not ready to boot the server. Fix the issues above.\n");
    process.exit(1);
  }

  console.log("✅ Environment looks good. Try `npm run dev`.\n");
})();
