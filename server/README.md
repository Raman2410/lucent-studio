# 📸 Photographer Website — Backend

A production-grade, scalable backend for a professional photographer's portfolio and booking platform. Built with Node.js, Express, MongoDB, Redis, and integrated with AWS S3, Razorpay, and Claude AI.

This project solves a real gap: photographers have social media presence but no professional platform to showcase services, manage bookings, rent equipment, and handle client queries — all in one place.

---

## 🎯 What This Project Demonstrates

- RESTful API design with clean separation of concerns (routes → controllers → services → models)
- JWT authentication with a **lazy auth** pattern — public browsing, login only when needed
- Real-time features via **WebSockets** (Socket.io) for live booking status updates
- **Redis caching** (cache-aside pattern) for a high-traffic availability calendar
- Full payment lifecycle with **Razorpay** — order creation, signature verification, refunds
- **AI-powered chatbot** using Claude API with token streaming (SSE)
- AWS S3 integration for image storage with presigned URLs
- Automated email system — 6 distinct transactional email triggers
- Joi-based request validation across every endpoint
- Jest + Supertest test suite with real MongoDB/Redis integration testing
- Dockerized with multi-stage builds + GitHub Actions CI/CD pipeline
- Auto-generated Swagger/OpenAPI documentation

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Cache | Redis (ioredis) |
| Auth | JWT + bcrypt |
| File Storage | AWS S3 |
| Payments | Razorpay |
| AI | Claude API (Anthropic SDK) — streaming |
| Real-time | Socket.io |
| Email | Nodemailer (Gmail SMTP) |
| Validation | Joi |
| Testing | Jest + Supertest |
| Docs | Swagger (OpenAPI 3.0) |
| DevOps | Docker + GitHub Actions |

---

## 📁 Project Structure

```
photographer-website/
├── server/
│   ├── src/
│   │   ├── app.js                 # Express app — middlewares + routes
│   │   ├── socket.js              # WebSocket events
│   │   ├── config/                # DB, Redis, AWS, Nodemailer, Razorpay
│   │   ├── models/                # 7 Mongoose schemas
│   │   ├── controllers/           # 9 controllers — request handlers
│   │   ├── routes/                # 9 route files
│   │   ├── middlewares/           # error, auth, validate, upload
│   │   ├── services/              # email, claude, razorpay, s3
│   │   └── utils/                 # apiResponse wrapper
│   ├── tests/                     # Jest + Supertest suite
│   ├── server.js                  # Entry point
│   ├── Dockerfile                 # Multi-stage build
│   ├── docker-compose.yml         # Production orchestration
│   └── docker-compose.dev.yml     # Dev override (hot reload)
├── .github/workflows/ci-cd.yml    # CI/CD pipeline
├── docs/postman/                  # Importable Postman collection
└── README.md
```

---

## 🚀 Getting Started

### Option 1 — Docker (Recommended, one command)

```bash
git clone <repo-url>
cd photographer-website/server
cp .env.example .env.production   # fill in real values
docker-compose up
```

That's it. Backend runs on `http://localhost:5000`, MongoDB and Redis spin up automatically.

### Option 2 — Local Development

**Prerequisites:** Node.js 20+, MongoDB running locally, Redis running locally

```bash
cd photographer-website/server
npm install
cp .env.example .env.development   # fill in real values
npm run dev
```

### Option 3 — Docker with Hot Reload (Development)

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env.development` or `.env.production` and fill in:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection details |
| `JWT_SECRET` | Min 32-character random string |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM credentials with S3 access |
| `AWS_BUCKET_NAME` / `AWS_REGION` | S3 bucket configuration |
| `SMTP_EMAIL` / `SMTP_PASSWORD` | Gmail address + [App Password](https://myaccount.google.com/apppasswords) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | From [Razorpay Dashboard](https://dashboard.razorpay.com) |
| `RAZORPAY_WEBHOOK_SECRET` | From Razorpay Dashboard → Webhooks → Secret. **Required** — the app refuses to boot without it, and `/api/payment/webhook` rejects any request that isn't signed with it. |
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) |
| `CLIENT_URL` | Frontend URL (for CORS) |

The app validates all required keys on startup and **crashes with a clear error** if any are missing — no silent failures.

---

## 📖 API Documentation

Once running, full interactive API docs are available at:

```
http://localhost:5000/api/docs
```

Raw OpenAPI JSON (importable into other tools):

```
http://localhost:5000/api/docs.json
```

### Postman Collection

Import `docs/postman/photographer-api.postman_collection.json` directly into Postman. It includes:
- All 53 endpoints, pre-organized by module
- Auto-saving auth token on login/register
- Auto-saving IDs (`bookingId`, `packageId`, etc.) as you test
- A ready-to-follow booking → payment flow

---

## 🗺️ API Overview

| Module | Base Path | Key Endpoints |
|---|---|---|
| Auth | `/api/auth` | register, login, me, change-password, logout |
| Photos | `/api/photos` | CRUD + bulk upload, featured, by category |
| Packages | `/api/packages` | CRUD + grouped, popular, by category |
| Cameras | `/api/cameras` | CRUD + availability, cost calculator |
| Availability | `/api/availability` | month view, check date, admin block/unblock |
| Bookings | `/api/bookings` | create, my bookings, reschedule, cancel, status |
| Payment | `/api/payment` | order, verify, status, webhook |
| Queries | `/api/queries` | create, my queries, rate AI response, close |
| Chat | `/api/chat` | streaming AI chatbot (SSE) |

---

## 🔄 Core Business Logic

### Booking Lifecycle
```
Pending → Payment Done → Confirmed → In Progress → Completed
                                                  ↘ Cancelled
```

### Lazy Authentication
Users browse the entire site — portfolio, packages, cameras — without logging in. JWT is only required when they attempt to book or submit a query.

### Cancellation & Refund Policy
Full refund via Razorpay if cancelled **48+ hours** before the scheduled shoot. Refund processed automatically through the Razorpay refunds API.

### Reschedule Policy
One free reschedule allowed, but only **within 24 hours** of the original booking creation, and the new date must pass the same 48-hour advance and availability checks.

### Unified Availability Calendar
A single `Availability` collection tracks both photography sessions and camera rentals together — max 3 bookings per day by default, auto-blocking when full, with Redis caching (1-hour TTL, invalidated on any booking change).

### AI Chatbot + Help Center
Three layers working together:
1. **Streaming chatbot** (Claude, SSE) — instant answers about packages, pricing, policies
2. **Query form** — for issues the AI can't resolve, with automatic email acknowledgement
3. **AI escalation** — the chatbot flags complex queries for human follow-up automatically

---

## 🧪 Testing

```bash
npm test                  # run full test suite
npm run test:coverage     # run with coverage report
```

Tests run against **real** MongoDB and Redis (not mocks), covering:
- Auth flows (register, login, password change, token invalidation)
- Booking lifecycle (creation, reschedule rules, cancellation, ownership checks)
- Availability calendar (auto-blocking, admin overrides, 48-hour rule)
- Payment signature verification and refund eligibility logic

---

## 🐳 Docker

```bash
docker-compose up                          # production mode
docker-compose -f docker-compose.yml \
  -f docker-compose.dev.yml up             # development mode (hot reload)
docker-compose down                        # stop everything
docker-compose down -v                     # stop + wipe volumes (fresh start)
```

The `Dockerfile` uses a multi-stage build — final production image excludes dev dependencies, test files, and runs as a non-root user.

---

## ⚙️ CI/CD

GitHub Actions pipeline (`.github/workflows/ci-cd.yml`) runs on every push/PR:

```
Lint → Test (real MongoDB + Redis) → Build Docker Image → Push (main only)
```

Add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` as repository secrets to enable the final push stage.

---

## 🔐 Security Measures

- Helmet.js for secure HTTP headers
- Rate limiting (stricter on auth routes — brute force protection)
- MongoDB query sanitization (NoSQL injection prevention)
- XSS input sanitization
- Joi validation on every request body/params/query
- bcrypt password hashing (cost factor 12)
- JWT in httpOnly cookies (XSS-safe) + Bearer header support (API clients)
- Razorpay payment signature verification (HMAC-SHA256)
- Non-root Docker container user

---

## 📝 License

ISC