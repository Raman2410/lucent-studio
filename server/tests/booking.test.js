"use strict";

const request = require("supertest");
const app = require("../src/app");
const Booking = require("../src/models/Booking.model");
const Availability = require("../src/models/Availability.model");

// helper — get a date N days from now in YYYY-MM-DD format
const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

describe("Booking API", () => {
  // ───────────────────────────────────────
  // CREATE BOOKING
  // ───────────────────────────────────────
  describe("POST /api/bookings", () => {
    it("should create a photography booking successfully", async () => {
      const { token } = await registerAndLogin();
      const pkg = await createTestPackage();

      const res = await request(app)
        .post("/api/bookings")
        .set(authHeader(token))
        .send({
          type: "photography",
          packageId: pkg._id.toString(),
          date: daysFromNow(10),
          time: "10:00",
          location: "Mumbai",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("Pending");
      expect(res.body.data.amount.total).toBe(25000);
    });

    it("should create a rental booking with accessories and photographer", async () => {
      const { token } = await registerAndLogin();
      const camera = await createTestCamera({
        accessories: [
          { name: "Tripod", additionalCharge: 200, isAvailable: true },
        ],
      });

      const res = await request(app)
        .post("/api/bookings")
        .set(authHeader(token))
        .send({
          type: "rental",
          cameraId: camera._id.toString(),
          rentalType: "daily",
          rentalQuantity: 2,
          accessories: ["Tripod"],
          withPhotographer: true,
          date: daysFromNow(10),
          time: "09:00",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.amount.total).toBeGreaterThan(0);
    });

    it("should reject booking without authentication", async () => {
      const pkg = await createTestPackage();

      const res = await request(app)
        .post("/api/bookings")
        .send({
          type: "photography",
          packageId: pkg._id.toString(),
          date: daysFromNow(10),
          time: "10:00",
        });

      expect(res.statusCode).toBe(401);
    });

    it("should reject booking less than 48 hours in advance", async () => {
      const { token } = await registerAndLogin();
      const pkg = await createTestPackage();

      const res = await request(app)
        .post("/api/bookings")
        .set(authHeader(token))
        .send({
          type: "photography",
          packageId: pkg._id.toString(),
          date: daysFromNow(1), // only 1 day away
          time: "10:00",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/48 hours/i);
    });

    it("should reject booking for non-existent package", async () => {
      const { token } = await registerAndLogin();
      const fakeId = "64f1a2b3c4d5e6f7a8b9c0d1";

      const res = await request(app)
        .post("/api/bookings")
        .set(authHeader(token))
        .send({
          type: "photography",
          packageId: fakeId,
          date: daysFromNow(10),
          time: "10:00",
        });

      expect(res.statusCode).toBe(404);
    });

    it("should reject booking for unavailable camera", async () => {
      const { token } = await registerAndLogin();
      const camera = await createTestCamera({ isAvailable: false });

      const res = await request(app)
        .post("/api/bookings")
        .set(authHeader(token))
        .send({
          type: "rental",
          cameraId: camera._id.toString(),
          rentalType: "daily",
          date: daysFromNow(10),
          time: "09:00",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/not available/i);
    });

    it("should reject when date is fully booked (3 bookings max)", async () => {
      const { token } = await registerAndLogin();
      // createTestPackage() defaults to category: "wedding", which the
      // controller routes to the separate "wedding" availability scope
      // (max 1/day). This test is about the general 3-per-day calendar,
      // so use a non-wedding category here to keep it on that scope.
      const pkg = await createTestPackage({ category: "portrait" });
      const targetDate = daysFromNow(10);

      // manually create a blocked availability record (general scope)
      const availability = await Availability.getOrCreate(targetDate);
      availability.bookingCount = 3;
      availability.maxBookingsPerDay = 3;
      availability.isBlocked = true;
      availability.blockType = "booking";
      availability.reason = "Fully booked";
      await availability.save();

      const res = await request(app)
        .post("/api/bookings")
        .set(authHeader(token))
        .send({
          type: "photography",
          packageId: pkg._id.toString(),
          date: targetDate,
          time: "10:00",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/not available/i);
    });
  });

  // ───────────────────────────────────────
  // GET MY BOOKINGS
  // ───────────────────────────────────────
  describe("GET /api/bookings/my", () => {
    it("should return only the logged-in user's bookings", async () => {
      const { token, user } = await registerAndLogin(global.TEST_USER);
      const { token: token2 } = await registerAndLogin(global.TEST_USER_2);

      const pkg = await createTestPackage();

      await createTestBooking(user._id, pkg._id);

      const res = await request(app)
        .get("/api/bookings/my")
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);

      // user 2 should see no bookings
      const res2 = await request(app)
        .get("/api/bookings/my")
        .set(authHeader(token2));

      expect(res2.body.data.length).toBe(0);
    });

    it("should filter bookings by status", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();

      await createTestBooking(user._id, pkg._id, { status: "Pending" });
      await createTestBooking(user._id, pkg._id, { status: "Completed" });

      const res = await request(app)
        .get("/api/bookings/my?status=Completed")
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe("Completed");
    });
  });

  // ───────────────────────────────────────
  // GET BOOKING BY ID
  // ───────────────────────────────────────
  describe("GET /api/bookings/:id", () => {
    it("should fetch booking by ID for owner", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id);

      const res = await request(app)
        .get(`/api/bookings/${booking._id}`)
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.data._id).toBe(booking._id.toString());
    });

    it("should reject access to another user's booking", async () => {
      const { user } = await registerAndLogin(global.TEST_USER);
      const { token: token2 } = await registerAndLogin(global.TEST_USER_2);

      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id);

      const res = await request(app)
        .get(`/api/bookings/${booking._id}`)
        .set(authHeader(token2));

      expect(res.statusCode).toBe(403);
    });

    it("should return 404 for non-existent booking", async () => {
      const { token } = await registerAndLogin();
      const fakeId = "64f1a2b3c4d5e6f7a8b9c0d1";

      const res = await request(app)
        .get(`/api/bookings/${fakeId}`)
        .set(authHeader(token));

      expect(res.statusCode).toBe(404);
    });
  });

  // ───────────────────────────────────────
  // RESCHEDULE BOOKING
  // ───────────────────────────────────────
  describe("PATCH /api/bookings/:id/reschedule", () => {
    it("should reschedule a confirmed booking within 24hrs of creation", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Confirmed",
      });

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/reschedule`)
        .set(authHeader(token))
        .send({
          newDate: daysFromNow(15),
          newTime: "14:00",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.newTime).toBe("14:00");

      const updated = await Booking.findById(booking._id);
      expect(updated.hasRescheduled).toBe(true);
    });

    it("should reject second reschedule attempt", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Confirmed",
        hasRescheduled: true,
      });

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/reschedule`)
        .set(authHeader(token))
        .send({
          newDate: daysFromNow(15),
          newTime: "14:00",
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already used/i);
    });

    it("should reject reschedule for non-confirmed booking", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Pending",
      });

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/reschedule`)
        .set(authHeader(token))
        .send({
          newDate: daysFromNow(15),
          newTime: "14:00",
        });

      expect(res.statusCode).toBe(400);
    });
  });

  // ───────────────────────────────────────
  // CANCEL BOOKING
  // ───────────────────────────────────────
  describe("PATCH /api/bookings/:id/cancel", () => {
    it("should cancel a pending booking without refund", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Pending",
      });

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/cancel`)
        .set(authHeader(token))
        .send({ reason: "Change of plans" });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe("Cancelled");
      expect(res.body.data.refundInitiated).toBe(false);
    });

    it("should reject cancelling another user's booking", async () => {
      const { user } = await registerAndLogin(global.TEST_USER);
      const { token: token2 } = await registerAndLogin(global.TEST_USER_2);

      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Pending",
      });

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/cancel`)
        .set(authHeader(token2))
        .send({ reason: "Not mine" });

      expect(res.statusCode).toBe(403);
    });

    it("should reject cancelling an already completed booking", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Completed",
      });

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/cancel`)
        .set(authHeader(token))
        .send({ reason: "Too late" });

      expect(res.statusCode).toBe(400);
    });
  });

  // ───────────────────────────────────────
  // BOOKING MODEL VIRTUALS
  // ───────────────────────────────────────
  describe("Booking model virtuals", () => {
    it("should generate a valid bookingRef", async () => {
      const pkg = await createTestPackage();
      const { user } = await registerAndLogin();
      const booking = await createTestBooking(user._id, pkg._id);

      expect(booking.bookingRef).toMatch(/^BK-[A-F0-9]{8}$/);
    });

    it("isCancellable should be true for Pending status", async () => {
      const pkg = await createTestPackage();
      const { user } = await registerAndLogin();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Pending",
      });

      expect(booking.isCancellable).toBe(true);
    });

    it("isCancellable should be false for Completed status", async () => {
      const pkg = await createTestPackage();
      const { user } = await registerAndLogin();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Completed",
      });

      expect(booking.isCancellable).toBe(false);
    });

    it("isOverdue should be false while a rental's planned return date is still in the future", async () => {
      const { user } = await registerAndLogin();
      const camera = await createTestCamera();
      const booking = await createTestRentalBooking(user._id, camera._id, {
        status: "In Progress",
      });

      expect(booking.isOverdue).toBe(false);
      expect(booking.overdueDays).toBe(0);
    });

    it("isOverdue should be true once a rental's planned return date has passed and it's still In Progress", async () => {
      const { user } = await registerAndLogin();
      const camera = await createTestCamera();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3); // 3 days ago, single-day daily rental

      const booking = await createTestRentalBooking(user._id, camera._id, {
        status: "In Progress",
        date: pastDate,
      });

      expect(booking.isOverdue).toBe(true);
      expect(booking.overdueDays).toBe(3);
    });

    it("isOverdue should be false once a booking is Completed, even past its planned return date", async () => {
      const { user } = await registerAndLogin();
      const camera = await createTestCamera();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);

      const booking = await createTestRentalBooking(user._id, camera._id, {
        status: "Completed",
        date: pastDate,
      });

      expect(booking.isOverdue).toBe(false);
    });

    it("plannedReturnDate should account for multi-day rentalQuantity on daily rentals without an endDate", async () => {
      const { user } = await registerAndLogin();
      const camera = await createTestCamera();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 10);

      const booking = await createTestRentalBooking(user._id, camera._id, {
        date: startDate,
        rentalType: "daily",
        rentalQuantity: 4,
      });

      const expected = new Date(startDate);
      expected.setDate(expected.getDate() + 3); // 4-day rental → planned return on day 4

      expect(new Date(booking.plannedReturnDate).toDateString()).toBe(
        expected.toDateString(),
      );
    });
  });

  // ───────────────────────────────────────
  // PATCH /api/bookings/:id/status — handover tracking + late fees
  // ───────────────────────────────────────
  describe("PATCH /api/bookings/:id/status", () => {
    it("should record pickedUpAt when admin marks a booking In Progress", async () => {
      const { token: adminToken } = await registerAndLoginAdmin();
      const { user } = await registerAndLogin(global.TEST_USER_2);
      const camera = await createTestCamera();
      const booking = await createTestRentalBooking(user._id, camera._id, {
        status: "Confirmed",
      });

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/status`)
        .set(authHeader(adminToken))
        .send({ status: "In Progress" });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe("In Progress");
      expect(res.body.data.handover.pickedUpAt).toBeTruthy();
      expect(res.body.data.handover.returnedAt).toBeFalsy();
      expect(res.body.data.lateFee).toBe(0);
    });

    it("should apply no late fee when a rental is returned on time", async () => {
      const { token: adminToken } = await registerAndLoginAdmin();
      const { user } = await registerAndLogin(global.TEST_USER_2);
      const camera = await createTestCamera();
      const booking = await createTestRentalBooking(user._id, camera._id, {
        status: "In Progress",
      });

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/status`)
        .set(authHeader(adminToken))
        .send({ status: "Completed" });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe("Completed");
      expect(res.body.data.lateFee).toBe(0);
      expect(res.body.data.amount.total).toBe(booking.amount.total);
      expect(res.body.data.handover.returnedAt).toBeTruthy();
    });

    it("should calculate and apply a late fee when a rental is returned past its planned return date", async () => {
      const { token: adminToken } = await registerAndLoginAdmin();
      const { user } = await registerAndLogin(global.TEST_USER_2);
      const camera = await createTestCamera({
        rentalRates: { hourly: 500, daily: 3000, weekend: 5000 },
      });
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2); // 2 days overdue

      const booking = await createTestRentalBooking(user._id, camera._id, {
        status: "In Progress",
        date: pastDate,
        amount: {
          subtotal: 3000,
          securityDeposit: 5000,
          total: 8000,
          currency: "INR",
        },
      });

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/status`)
        .set(authHeader(adminToken))
        .send({ status: "Completed" });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.overdueDays).toBe(2);
      expect(res.body.data.lateFee).toBe(6000); // 2 days * ₹3000 dailyRate snapshot
      expect(res.body.data.amount.total).toBe(14000); // 8000 + 6000
    });

    it("should waive the late fee when the admin explicitly requests it", async () => {
      const { token: adminToken } = await registerAndLoginAdmin();
      const { user } = await registerAndLogin(global.TEST_USER_2);
      const camera = await createTestCamera();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      const booking = await createTestRentalBooking(user._id, camera._id, {
        status: "In Progress",
        date: pastDate,
      });

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/status`)
        .set(authHeader(adminToken))
        .send({ status: "Completed", waiveLateFee: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.lateFee).toBe(0);
      expect(res.body.data.amount.total).toBe(booking.amount.total);
    });

    it("should reject a non-admin trying to update booking status", async () => {
      const { token } = await registerAndLogin();
      const camera = await createTestCamera();
      const booking = await createTestRentalBooking(
        (await registerAndLogin(global.TEST_USER_2)).user._id,
        camera._id,
        { status: "Confirmed" },
      );

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/status`)
        .set(authHeader(token))
        .send({ status: "In Progress" });

      expect(res.statusCode).toBe(403);
    });

    it("should reject an invalid status transition", async () => {
      const { token: adminToken } = await registerAndLoginAdmin();
      const { user } = await registerAndLogin(global.TEST_USER_2);
      const camera = await createTestCamera();
      const booking = await createTestRentalBooking(user._id, camera._id, {
        status: "Pending", // can't go straight to Completed
      });

      const res = await request(app)
        .patch(`/api/bookings/${booking._id}/status`)
        .set(authHeader(adminToken))
        .send({ status: "Completed" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Cannot transition/i);
    });
  });

  // ───────────────────────────────────────
  // GET /api/bookings/overdue
  // ───────────────────────────────────────
  describe("GET /api/bookings/overdue", () => {
    it("should list rentals past their planned return date that aren't Completed", async () => {
      const { token: adminToken } = await registerAndLoginAdmin();
      const { user } = await registerAndLogin(global.TEST_USER_2);
      const camera = await createTestCamera();

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const overdueBooking = await createTestRentalBooking(
        user._id,
        camera._id,
        {
          status: "In Progress",
          date: pastDate,
        },
      );

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      await createTestRentalBooking(user._id, camera._id, {
        status: "Confirmed",
        date: futureDate,
      });

      const res = await request(app)
        .get("/api/bookings/overdue")
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id).toBe(overdueBooking._id.toString());
    });

    it("should not list a rental as overdue once it's been marked Completed", async () => {
      const { token: adminToken } = await registerAndLoginAdmin();
      const { user } = await registerAndLogin(global.TEST_USER_2);
      const camera = await createTestCamera();

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      await createTestRentalBooking(user._id, camera._id, {
        status: "Completed",
        date: pastDate,
      });

      const res = await request(app)
        .get("/api/bookings/overdue")
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("should reject a non-admin from listing overdue bookings", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .get("/api/bookings/overdue")
        .set(authHeader(token));

      expect(res.statusCode).toBe(403);
    });
  });
});
