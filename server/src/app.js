"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const xssClean = require("xss-clean");
const rateLimit = require("express-rate-limit");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// ─────────────────────────────────────────
// ROUTE IMPORTS
// ─────────────────────────────────────────
const authRoutes = require("./routes/auth.routes");
const photoRoutes = require("./routes/photo.routes");
const packageRoutes = require("./routes/package.routes");
const cameraRoutes = require("./routes/camera.routes");
const bookingRoutes = require("./routes/booking.routes");
const availabilityRoutes = require("./routes/availability.routes");
const queryRoutes = require("./routes/query.routes");
const chatRoutes = require("./routes/chat.routes");
const paymentRoutes = require("./routes/payment.routes");
const adminRoutes = require("./routes/admin.routes");
const notificationRoutes = require("./routes/notification.routes");
const reviewRoutes = require("./routes/review.routes");
const { handleWebhook } = require("./controllers/payment.controller");

// ─────────────────────────────────────────
// MIDDLEWARE IMPORTS
// ─────────────────────────────────────────
const { errorHandler } = require("./middlewares/error.middleware"); 

const app = express();

// ─────────────────────────────────────────
// SECURITY MIDDLEWARES
// ─────────────────────────────────────────

// set secure HTTP headers
app.use(helmet());

// CORS — allow only our frontend
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true, // allow cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// rate limiting — applied to all /api routes
// skipped entirely in test env: express-rate-limit's in-memory store
// persists for the life of this app instance (i.e. the whole test file
// under Jest), so a full describe suite of auth/booking/payment tests
// can easily exceed even a generous ceiling well before anything is
// actually wrong — these limits exist for production brute-force
// protection, not test correctness.
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 mins
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 requests
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message:
      "Too many requests from this IP. Please try again after 15 minutes.",
  },
});
app.use("/api", limiter);

// stricter rate limit for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 20, // max 20 login/register attempts
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many auth attempts. Please try again after 15 minutes.",
  },
});

// ─────────────────────────────────────────
// RAZORPAY WEBHOOK — must be registered BEFORE the global
// express.json()/mongoSanitize()/xssClean() middlewares below.
// Signature verification needs the exact raw request bytes Razorpay
// signed; once express.json() parses the body into an object, that
// information is lost (JSON.stringify on the parsed object is not
// guaranteed to reproduce the original bytes). This route ends the
// response itself, so it never falls through to the later JSON parser.
// ─────────────────────────────────────────
app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook,
);

// sanitize MongoDB queries — prevent NoSQL injection
// e.g. { "$gt": "" } in request body gets stripped
app.use(mongoSanitize());

// sanitize user input — prevent XSS attacks
// e.g. <script>alert(1)</script> gets escaped
app.use(xssClean());

// ─────────────────────────────────────────
// GENERAL MIDDLEWARES
// ─────────────────────────────────────────

// parse incoming JSON bodies
app.use(express.json({ limit: "10kb" })); // limit payload size

// parse URL-encoded bodies (form data)
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// parse cookies (for JWT httpOnly cookie)
app.use(cookieParser());

// HTTP request logger — only in development
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ─────────────────────────────────────────
// SWAGGER — API DOCUMENTATION
// ─────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Photographer Website API",
      version: "1.0.0",
      description: `
## Photographer Portfolio & Booking Platform

A production-grade REST API for a photographer's professional website.

### Features
- 📸 Portfolio management by category
- 📦 Photography packages (fixed, custom, hourly)
- 📷 Camera & accessories rental
- 📅 Real-time availability calendar (Redis cached)
- 💳 Razorpay payment + refund flow
- 🔐 JWT authentication (lazy — only on booking/query)
- 🤖 Claude AI powered chatbot (streaming)
- 📧 Automated email notifications (6 triggers)
- 🔌 WebSocket real-time booking status updates

### Authentication
Most endpoints are public. JWT is required only for booking and query actions.
Use the \`/api/auth/login\` endpoint to get a token, then click **Authorize** above.
      `,
      contact: {
        name: "API Support",
        email: "support@photographerstudio.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: "Development server",
      },
      {
        url: "https://api.photographerstudio.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token from /api/auth/login",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "jwt",
          description: "JWT stored in httpOnly cookie (auto-sent by browser)",
        },
      },
      schemas: {
        // reusable success response
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation successful" },
            data: { type: "object" },
          },
        },
        // reusable error response
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Something went wrong" },
            error: { type: "string" },
          },
        },
        // pagination meta
        PaginationMeta: {
          type: "object",
          properties: {
            total: { type: "integer", example: 50 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 5 },
          },
        },
      },
    },
  },
  // scan all route files for JSDoc swagger comments
  apis: ["./src/routes/*.js", "./src/models/*.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "Photographer API Docs",
    customCss: `
      .swagger-ui .topbar { background-color: #1a1a2e; }
      .swagger-ui .topbar-wrapper img { display: none; }
      .swagger-ui .topbar-wrapper::after {
        content: "📸 Photographer API";
        color: white;
        font-size: 1.2rem;
        font-weight: bold;
      }
    `,
  }),
);

// serve raw swagger JSON (useful for Postman import)
app.get("/api/docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/photos", photoRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/cameras", cameraRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/queries", queryRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reviews", reviewRoutes);

// ─────────────────────────────────────────
// 404 HANDLER — unknown routes
// ─────────────────────────────────────────
app.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─────────────────────────────────────────
// GLOBAL ERROR HANDLER
// must be last middleware
// ─────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
