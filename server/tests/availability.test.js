"use strict";

const request = require("supertest");
const app = require("../src/app");
const Availability = require("../src/models/Availability.model");

const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const monthFromNow = (monthsAhead = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

describe("Availability API", () => {
  // ───────────────────────────────────────
  // GET MONTH AVAILABILITY
  // ───────────────────────────────────────
  describe("GET /api/availability/:month", () => {
    it("should return full calendar for a valid month", async () => {
      const month = monthFromNow(1);

      const res = await request(app).get(`/api/availability/${month}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.month).toBe(month);
      expect(Array.isArray(res.body.data.calendar)).toBe(true);
      expect(res.body.data.calendar.length).toBeGreaterThan(27); // min days in a month
      expect(res.body.data.summary).toBeDefined();
    });

    it("should reject invalid month format", async () => {
      const res = await request(app).get("/api/availability/2024-13");

      expect(res.statusCode).toBe(400);
    });

    it("should reject malformed month string", async () => {
      const res = await request(app).get("/api/availability/not-a-month");

      expect(res.statusCode).toBe(400);
    });

    it("should mark dates with bookings as blocked when max reached", async () => {
      const month = monthFromNow(1);
      const targetDate = `${month}-15`;

      const availability = await Availability.getOrCreate(targetDate);
      availability.bookingCount = 3;
      availability.maxBookingsPerDay = 3;
      availability.isBlocked = true;
      availability.blockType = "booking";
      await availability.save();

      const res = await request(app).get(`/api/availability/${month}`);

      const dayRecord = res.body.data.calendar.find(
        (d) => d.date === targetDate,
      );

      expect(dayRecord.isBlocked).toBe(true);
      expect(dayRecord.blockType).toBe("booking");
    });

    it("should mark past dates as blocked automatically", async () => {
      const currentMonth = monthFromNow(0);

      const res = await request(app).get(`/api/availability/${currentMonth}`);

      const today = new Date();
      const pastDay = res.body.data.calendar.find((d) => {
        const dayDate = new Date(d.date);
        return dayDate < today && d.date !== today.toISOString().split("T")[0];
      });

      if (pastDay) {
        expect(pastDay.isPast).toBe(true);
        expect(pastDay.isBlocked).toBe(true);
      }
    });
  });

  // ───────────────────────────────────────
  // CHECK SINGLE DATE
  // ───────────────────────────────────────
  describe("GET /api/availability/check", () => {
    it("should return available=true for an open future date", async () => {
      const date = daysFromNow(10);

      const res = await request(app).get(
        `/api/availability/check?date=${date}`,
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.data.available).toBe(true);
    });

    it("should return available=false for a date less than 48hrs away", async () => {
      const date = daysFromNow(1);

      const res = await request(app).get(
        `/api/availability/check?date=${date}`,
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.data.available).toBe(false);
      expect(res.body.data.reason).toMatch(/48 hours/i);
    });

    it("should return available=false for a past date", async () => {
      const date = daysFromNow(-5);

      const res = await request(app).get(
        `/api/availability/check?date=${date}`,
      );

      expect(res.body.data.available).toBe(false);
      expect(res.body.data.reason).toMatch(/past/i);
    });

    it("should reject missing date parameter", async () => {
      const res = await request(app).get("/api/availability/check");

      expect(res.statusCode).toBe(400);
    });

    it("should reject invalid date format", async () => {
      const res = await request(app).get(
        "/api/availability/check?date=15-08-2024",
      );

      expect(res.statusCode).toBe(400);
    });
  });

  // ───────────────────────────────────────
  // ADMIN — BLOCK DATE
  // ───────────────────────────────────────
  describe("POST /api/availability/block", () => {
    it("should reject an unauthenticated request", async () => {
      const date = daysFromNow(20);

      const res = await request(app)
        .post("/api/availability/block")
        .send({ date, reason: "Personal holiday" });

      expect(res.statusCode).toBe(401);
    });

    it("should reject a request from a non-admin user", async () => {
      const date = daysFromNow(20);
      const { token } = await registerAndLogin();

      const res = await request(app)
        .post("/api/availability/block")
        .set(authHeader(token))
        .send({ date, reason: "Personal holiday" });

      expect(res.statusCode).toBe(403);
    });

    it("should block a future date successfully as admin", async () => {
      const date = daysFromNow(20);
      const { token } = await registerAndLoginAdmin();

      const res = await request(app)
        .post("/api/availability/block")
        .set(authHeader(token))
        .send({ date, reason: "Personal holiday" });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isBlocked).toBe(true);
      expect(res.body.data.blockType).toBe("admin");

      const record = await Availability.findOne({
        date: new Date(date),
      });
      expect(record.isAdminBlocked).toBe(true);
    });

    it("should reject blocking a past date", async () => {
      const date = daysFromNow(-5);
      const { token } = await registerAndLoginAdmin();

      const res = await request(app)
        .post("/api/availability/block")
        .set(authHeader(token))
        .send({ date, reason: "Too late" });

      expect(res.statusCode).toBe(400);
    });

    it("should block both calendars by default (scope=all)", async () => {
      const date = daysFromNow(20);
      const { token } = await registerAndLoginAdmin();

      const res = await request(app)
        .post("/api/availability/block")
        .set(authHeader(token))
        .send({ date, reason: "Photographer on leave" });

      expect(res.statusCode).toBe(200);

      const general = await Availability.findOne({ date: new Date(date), scope: "general" });
      const wedding = await Availability.findOne({ date: new Date(date), scope: "wedding" });
      expect(general.isAdminBlocked).toBe(true);
      expect(wedding.isAdminBlocked).toBe(true);
    });

    it("should block only the requested calendar when scope is given", async () => {
      const date = daysFromNow(20);
      const { token } = await registerAndLoginAdmin();

      const res = await request(app)
        .post("/api/availability/block")
        .set(authHeader(token))
        .send({ date, reason: "Wedding team off", scope: "wedding" });

      expect(res.statusCode).toBe(200);

      const wedding = await Availability.findOne({ date: new Date(date), scope: "wedding" });
      const general = await Availability.findOne({ date: new Date(date), scope: "general" });
      expect(wedding.isAdminBlocked).toBe(true);
      expect(general).toBeNull(); // never created — general calendar untouched
    });
  });

  // ───────────────────────────────────────
  // ADMIN — UNBLOCK DATE
  // ───────────────────────────────────────
  describe("DELETE /api/availability/unblock/:date", () => {
    it("should reject an unauthenticated request", async () => {
      const date = daysFromNow(20);

      const res = await request(app).delete(
        `/api/availability/unblock/${date}`,
      );

      expect(res.statusCode).toBe(401);
    });

    it("should unblock a previously admin-blocked date", async () => {
      const date = daysFromNow(20);
      const { token } = await registerAndLoginAdmin();

      await request(app)
        .post("/api/availability/block")
        .set(authHeader(token))
        .send({ date, reason: "Holiday" });

      const res = await request(app)
        .delete(`/api/availability/unblock/${date}`)
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isBlocked).toBe(false);
    });

    it("should keep date blocked if bookings exist even after unblock", async () => {
      const date = daysFromNow(20);
      const { token } = await registerAndLoginAdmin();

      const availability = await Availability.getOrCreate(date);
      availability.isAdminBlocked = true;
      availability.isBlocked = true;
      availability.blockType = "admin";
      availability.bookingCount = 3;
      availability.maxBookingsPerDay = 3;
      await availability.save();

      const res = await request(app)
        .delete(`/api/availability/unblock/${date}`)
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      // still blocked because bookingCount >= maxBookingsPerDay
      expect(res.body.data.isBlocked).toBe(true);
      expect(res.body.data.bookingCount).toBe(3);
    });

    it("should return 404 for date with no availability record", async () => {
      const date = daysFromNow(100);
      const { token } = await registerAndLoginAdmin();

      const res = await request(app)
        .delete(`/api/availability/unblock/${date}`)
        .set(authHeader(token));

      expect(res.statusCode).toBe(404);
    });
  });

  // ───────────────────────────────────────
  // ADMIN — LIST BLOCKED DATES
  // route ordering: "/blocked" must not be
  // swallowed by the generic "/:month" route
  // ───────────────────────────────────────
  describe("GET /api/availability/blocked", () => {
    it("should reject an unauthenticated request", async () => {
      const res = await request(app).get("/api/availability/blocked");
      expect(res.statusCode).toBe(401);
    });

    it("should list admin-blocked dates for an admin", async () => {
      const date = daysFromNow(20);
      const { token } = await registerAndLoginAdmin();

      await request(app)
        .post("/api/availability/block")
        .set(authHeader(token))
        .send({ date, reason: "Holiday" });

      const res = await request(app)
        .get("/api/availability/blocked")
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  // ───────────────────────────────────────
  // MODEL METHODS — addBooking / removeBooking
  // ───────────────────────────────────────
  describe("Availability model methods", () => {
    it("addBooking should increment count and auto-block at max", async () => {
      const date = daysFromNow(25);
      const availability = await Availability.getOrCreate(date);

      await availability.addBooking(
        "64f1a2b3c4d5e6f7a8b9c0d1",
        "photography",
        "10:00",
      );
      await availability.addBooking(
        "64f1a2b3c4d5e6f7a8b9c0d2",
        "photography",
        "14:00",
      );

      expect(availability.bookingCount).toBe(2);
      expect(availability.isBlocked).toBe(false);

      await availability.addBooking(
        "64f1a2b3c4d5e6f7a8b9c0d3",
        "rental",
        "16:00",
      );

      expect(availability.bookingCount).toBe(3);
      expect(availability.isBlocked).toBe(true); // auto-blocked at max
    });

    it("removeBooking should decrement count and unblock", async () => {
      const date = daysFromNow(26);
      const availability = await Availability.getOrCreate(date);

      const bookingId = "64f1a2b3c4d5e6f7a8b9c0d1";
      await availability.addBooking(bookingId, "photography", "10:00");
      await availability.addBooking(
        "64f1a2b3c4d5e6f7a8b9c0d2",
        "photography",
        "12:00",
      );
      await availability.addBooking(
        "64f1a2b3c4d5e6f7a8b9c0d3",
        "rental",
        "14:00",
      );

      expect(availability.isBlocked).toBe(true);

      await availability.removeBooking(bookingId);

      expect(availability.bookingCount).toBe(2);
      expect(availability.isBlocked).toBe(false); // unblocked below max
    });

    it("checkDate should return remainingSlots correctly", async () => {
      const date = daysFromNow(27);
      const availability = await Availability.getOrCreate(date);
      await availability.addBooking(
        "64f1a2b3c4d5e6f7a8b9c0d1",
        "photography",
        "10:00",
      );

      const result = await Availability.checkDate(date);

      expect(result.available).toBe(true);
      expect(result.remainingSlots).toBe(2); // 3 max - 1 booked
    });
  });
});
