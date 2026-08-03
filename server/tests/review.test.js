"use strict";

const request = require("supertest");
const app = require("../src/app");
const Booking = require("../src/models/Booking.model");
const Package = require("../src/models/Package.model");
const Camera = require("../src/models/Camera.model");

describe("Review API", () => {
  // ───────────────────────────────────────
  // CREATE REVIEW
  // ───────────────────────────────────────
  describe("POST /api/reviews", () => {
    it("should create a review for a completed photography booking", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Completed",
      });

      const res = await request(app)
        .post("/api/reviews")
        .set(authHeader(token))
        .send({
          bookingId: booking._id.toString(),
          rating: 5,
          comment: "Absolutely wonderful shoot!",
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.review.rating).toBe(5);
      expect(res.body.data.review.targetType).toBe("package");

      // package's cached rating should reflect the new review
      const updatedPkg = await Package.findById(pkg._id);
      expect(updatedPkg.ratingsAverage).toBe(5);
      expect(updatedPkg.ratingsCount).toBe(1);

      // booking should be flagged as reviewed
      const updatedBooking = await Booking.findById(booking._id);
      expect(updatedBooking.hasReview).toBe(true);
    });

    it("should create a review for a completed rental booking", async () => {
      const { token, user } = await registerAndLogin();
      const camera = await createTestCamera();
      const booking = await createTestRentalBooking(user._id, camera._id, {
        status: "Completed",
      });

      const res = await request(app)
        .post("/api/reviews")
        .set(authHeader(token))
        .send({ bookingId: booking._id.toString(), rating: 4 });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.review.targetType).toBe("camera");

      const updatedCamera = await Camera.findById(camera._id);
      expect(updatedCamera.ratingsAverage).toBe(4);
      expect(updatedCamera.ratingsCount).toBe(1);
    });

    it("should reject a review for a non-completed booking", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Confirmed",
      });

      const res = await request(app)
        .post("/api/reviews")
        .set(authHeader(token))
        .send({ bookingId: booking._id.toString(), rating: 5 });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/completed/i);
    });

    it("should reject reviewing someone else's booking", async () => {
      const { user: owner } = await registerAndLogin(global.TEST_USER);
      const pkg = await createTestPackage();
      const booking = await createTestBooking(owner._id, pkg._id, {
        status: "Completed",
      });

      const { token: otherToken } = await registerAndLogin(global.TEST_USER_2);

      const res = await request(app)
        .post("/api/reviews")
        .set(authHeader(otherToken))
        .send({ bookingId: booking._id.toString(), rating: 3 });

      expect(res.statusCode).toBe(403);
    });

    it("should reject a duplicate review for the same booking", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Completed",
      });

      await request(app)
        .post("/api/reviews")
        .set(authHeader(token))
        .send({ bookingId: booking._id.toString(), rating: 5 });

      const res = await request(app)
        .post("/api/reviews")
        .set(authHeader(token))
        .send({ bookingId: booking._id.toString(), rating: 2 });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already reviewed/i);
    });

    it("should reject a rating outside 1-5", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, {
        status: "Completed",
      });

      const res = await request(app)
        .post("/api/reviews")
        .set(authHeader(token))
        .send({ bookingId: booking._id.toString(), rating: 7 });

      expect(res.statusCode).toBe(400);
    });

    it("should reject unauthenticated requests", async () => {
      const res = await request(app)
        .post("/api/reviews")
        .send({ bookingId: "64f1a2b3c4d5e6f7a8b9c0d1", rating: 5 });

      expect(res.statusCode).toBe(401);
    });
  });

  // ───────────────────────────────────────
  // LIST REVIEWS — public
  // ───────────────────────────────────────
  describe("GET /api/reviews/package/:id", () => {
    it("should list reviews with the average rating", async () => {
      const { token: token1, user: user1 } = await registerAndLogin(global.TEST_USER);
      const pkg = await createTestPackage();
      const booking1 = await createTestBooking(user1._id, pkg._id, { status: "Completed" });
      await request(app)
        .post("/api/reviews")
        .set(authHeader(token1))
        .send({ bookingId: booking1._id.toString(), rating: 4 });

      const { token: token2, user: user2 } = await registerAndLogin(global.TEST_USER_2);
      const booking2 = await createTestBooking(user2._id, pkg._id, { status: "Completed" });
      await request(app)
        .post("/api/reviews")
        .set(authHeader(token2))
        .send({ bookingId: booking2._id.toString(), rating: 2 });

      const res = await request(app).get(`/api/reviews/package/${pkg._id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.reviews).toHaveLength(2);
      expect(res.body.data.ratingsAverage).toBe(3); // (4+2)/2
      expect(res.body.data.ratingsCount).toBe(2);
    });

    it("should return zero average for a package with no reviews", async () => {
      const pkg = await createTestPackage();

      const res = await request(app).get(`/api/reviews/package/${pkg._id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.reviews).toHaveLength(0);
      expect(res.body.data.ratingsAverage).toBe(0);
    });
  });

  // ───────────────────────────────────────
  // MY REVIEWS
  // ───────────────────────────────────────
  describe("GET /api/reviews/my", () => {
    it("should list only the current user's reviews", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, { status: "Completed" });
      await request(app)
        .post("/api/reviews")
        .set(authHeader(token))
        .send({ bookingId: booking._id.toString(), rating: 5 });

      const res = await request(app).get("/api/reviews/my").set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.reviews).toHaveLength(1);
    });
  });

  // ───────────────────────────────────────
  // DELETE REVIEW
  // ───────────────────────────────────────
  describe("DELETE /api/reviews/:id", () => {
    it("should let the owner delete their own review and recalculate ratings", async () => {
      const { token, user } = await registerAndLogin();
      const pkg = await createTestPackage();
      const booking = await createTestBooking(user._id, pkg._id, { status: "Completed" });
      const createRes = await request(app)
        .post("/api/reviews")
        .set(authHeader(token))
        .send({ bookingId: booking._id.toString(), rating: 5 });

      const reviewId = createRes.body.data.review._id;

      const res = await request(app)
        .delete(`/api/reviews/${reviewId}`)
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);

      const updatedPkg = await Package.findById(pkg._id);
      expect(updatedPkg.ratingsCount).toBe(0);
      expect(updatedPkg.ratingsAverage).toBe(0);
    });

    it("should reject deleting someone else's review", async () => {
      const { token: ownerToken, user: owner } = await registerAndLogin(global.TEST_USER);
      const pkg = await createTestPackage();
      const booking = await createTestBooking(owner._id, pkg._id, { status: "Completed" });
      const createRes = await request(app)
        .post("/api/reviews")
        .set(authHeader(ownerToken))
        .send({ bookingId: booking._id.toString(), rating: 5 });

      const { token: otherToken } = await registerAndLogin(global.TEST_USER_2);

      const res = await request(app)
        .delete(`/api/reviews/${createRes.body.data.review._id}`)
        .set(authHeader(otherToken));

      expect(res.statusCode).toBe(403);
    });

    it("should let an admin delete any review", async () => {
      const { token: ownerToken, user: owner } = await registerAndLogin(global.TEST_USER);
      const pkg = await createTestPackage();
      const booking = await createTestBooking(owner._id, pkg._id, { status: "Completed" });
      const createRes = await request(app)
        .post("/api/reviews")
        .set(authHeader(ownerToken))
        .send({ bookingId: booking._id.toString(), rating: 5 });

      const { token: adminToken } = await registerAndLoginAdmin(global.TEST_USER_2);

      const res = await request(app)
        .delete(`/api/reviews/${createRes.body.data.review._id}`)
        .set(authHeader(adminToken));

      expect(res.statusCode).toBe(200);
    });
  });
});
