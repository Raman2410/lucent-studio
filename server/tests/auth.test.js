"use strict";

const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User.model");

describe("Auth API", () => {
  // ───────────────────────────────────────
  // REGISTER
  // ───────────────────────────────────────
  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(global.TEST_USER);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.data.user.email).toBe(global.TEST_USER.email);
      expect(res.body.data.user.password).toBeUndefined(); // never expose password
    });

    it("should reject duplicate email registration", async () => {
      await request(app).post("/api/auth/register").send(global.TEST_USER);

      const res = await request(app)
        .post("/api/auth/register")
        .send(global.TEST_USER);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already registered/i);
    });

    it("should reject weak password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ ...global.TEST_USER, password: "weak" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ ...global.TEST_USER, email: "not-an-email" });

      expect(res.statusCode).toBe(400);
    });

    it("should reject invalid phone number", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ ...global.TEST_USER, phone: "12345" });

      expect(res.statusCode).toBe(400);
    });

    it("should hash the password before saving", async () => {
      await request(app).post("/api/auth/register").send(global.TEST_USER);

      const user = await User.findOne({ email: global.TEST_USER.email }).select(
        "+password",
      );

      expect(user.password).not.toBe(global.TEST_USER.password);
      expect(user.password.startsWith("$2")).toBe(true); // bcrypt hash prefix
    });
  });

  // ───────────────────────────────────────
  // LOGIN
  // ───────────────────────────────────────
  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await request(app).post("/api/auth/register").send(global.TEST_USER);
    });

    it("should login with correct credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: global.TEST_USER.email,
        password: global.TEST_USER.password,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.data.user.email).toBe(global.TEST_USER.email);
    });

    it("should reject incorrect password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: global.TEST_USER.email,
        password: "WrongPassword@123",
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/invalid email or password/i);
    });

    it("should reject non-existent email", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "Test@1234",
      });

      expect(res.statusCode).toBe(401);
    });

    it("should set jwt cookie on successful login", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: global.TEST_USER.email,
        password: global.TEST_USER.password,
      });

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("jwt="))).toBe(true);
    });
  });

  // ───────────────────────────────────────
  // PROTECTED ROUTES
  // ───────────────────────────────────────
  describe("Protected routes", () => {
    it("should reject request without token", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/not logged in/i);
    });

    it("should reject request with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set(authHeader("invalid.token.here"));

      expect(res.statusCode).toBe(401);
    });

    it("should allow access with valid token", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app).get("/api/auth/me").set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.email).toBe(global.TEST_USER.email);
    });
  });

  // ───────────────────────────────────────
  // UPDATE PROFILE
  // ───────────────────────────────────────
  describe("PATCH /api/auth/me", () => {
    it("should update name and phone", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .patch("/api/auth/me")
        .set(authHeader(token))
        .send({ name: "Updated Name", phone: "9999999999" });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.name).toBe("Updated Name");
    });

    it("should reject password update via this route", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .patch("/api/auth/me")
        .set(authHeader(token))
        .send({ password: "NewPassword@123" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/not for password/i);
    });
  });

  // ───────────────────────────────────────
  // CHANGE PASSWORD
  // ───────────────────────────────────────
  describe("PATCH /api/auth/change-password", () => {
    it("should change password with correct current password", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .patch("/api/auth/change-password")
        .set(authHeader(token))
        .send({
          currentPassword: global.TEST_USER.password,
          newPassword: "NewPassword@123",
          confirmPassword: "NewPassword@123",
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeDefined(); // new token issued
    });

    it("should reject incorrect current password", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .patch("/api/auth/change-password")
        .set(authHeader(token))
        .send({
          currentPassword: "WrongPassword@123",
          newPassword: "NewPassword@123",
          confirmPassword: "NewPassword@123",
        });

      expect(res.statusCode).toBe(401);
    });

    it("should reject mismatched confirm password", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .patch("/api/auth/change-password")
        .set(authHeader(token))
        .send({
          currentPassword: global.TEST_USER.password,
          newPassword: "NewPassword@123",
          confirmPassword: "Different@123",
        });

      expect(res.statusCode).toBe(400);
    });

    it("should invalidate old token after password change", async () => {
      const { token } = await registerAndLogin();

      // change password
      await request(app)
        .patch("/api/auth/change-password")
        .set(authHeader(token))
        .send({
          currentPassword: global.TEST_USER.password,
          newPassword: "NewPassword@123",
          confirmPassword: "NewPassword@123",
        });

      // old token should now be rejected
      const res = await request(app).get("/api/auth/me").set(authHeader(token));

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/recently changed/i);
    });
  });

  // ───────────────────────────────────────
  // FORGOT PASSWORD
  // ───────────────────────────────────────
  describe("POST /api/auth/forgot-password", () => {
    it("should generate a reset token for an existing user", async () => {
      await registerAndLogin();

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: global.TEST_USER.email });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const user = await User.findOne({ email: global.TEST_USER.email }).select(
        "+passwordResetToken +passwordResetExpires",
      );
      expect(user.passwordResetToken).toBeDefined();
      expect(user.passwordResetExpires).toBeDefined();
    });

    it("should return generic success for unknown email (no enumeration)", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "doesnotexist@photographer.com" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/if an account exists/i);
    });

    it("should reject invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "not-an-email" });

      expect(res.statusCode).toBe(400);
    });
  });

  // ───────────────────────────────────────
  // RESET PASSWORD
  // ───────────────────────────────────────
  describe("PATCH /api/auth/reset-password/:token", () => {
    // helper — requests a reset and returns the PLAIN token by
    // reaching into the model layer directly (the plain token is
    // only ever visible in the outgoing email, never via the API)
    const requestResetToken = async () => {
      await registerAndLogin();
      const user = await User.findOne({ email: global.TEST_USER.email });
      const plainToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });
      return plainToken;
    };

    it("should reset password with a valid token", async () => {
      const plainToken = await requestResetToken();

      const res = await request(app)
        .patch(`/api/auth/reset-password/${plainToken}`)
        .send({ newPassword: "NewPassword@123", confirmPassword: "NewPassword@123" });

      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeDefined(); // logs user in immediately

      // old password should no longer work
      const oldLogin = await request(app).post("/api/auth/login").send({
        email: global.TEST_USER.email,
        password: global.TEST_USER.password,
      });
      expect(oldLogin.statusCode).toBe(401);

      // new password should work
      const newLogin = await request(app).post("/api/auth/login").send({
        email: global.TEST_USER.email,
        password: "NewPassword@123",
      });
      expect(newLogin.statusCode).toBe(200);
    });

    it("should reject an invalid/unknown token", async () => {
      const res = await request(app)
        .patch(`/api/auth/reset-password/${"a".repeat(64)}`)
        .send({ newPassword: "NewPassword@123", confirmPassword: "NewPassword@123" });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid or has expired/i);
    });

    it("should reject a malformed token", async () => {
      const res = await request(app)
        .patch("/api/auth/reset-password/not-a-valid-token")
        .send({ newPassword: "NewPassword@123", confirmPassword: "NewPassword@123" });

      expect(res.statusCode).toBe(400);
    });

    it("should reject an expired token", async () => {
      await registerAndLogin();
      const user = await User.findOne({ email: global.TEST_USER.email });
      const plainToken = user.createPasswordResetToken();
      user.passwordResetExpires = Date.now() - 1000; // force expiry
      await user.save({ validateBeforeSave: false });

      const res = await request(app)
        .patch(`/api/auth/reset-password/${plainToken}`)
        .send({ newPassword: "NewPassword@123", confirmPassword: "NewPassword@123" });

      expect(res.statusCode).toBe(400);
    });

    it("should reject mismatched confirm password", async () => {
      const plainToken = await requestResetToken();

      const res = await request(app)
        .patch(`/api/auth/reset-password/${plainToken}`)
        .send({ newPassword: "NewPassword@123", confirmPassword: "Different@123" });

      expect(res.statusCode).toBe(400);
    });

    it("should not allow reusing the same reset token twice", async () => {
      const plainToken = await requestResetToken();

      await request(app)
        .patch(`/api/auth/reset-password/${plainToken}`)
        .send({ newPassword: "NewPassword@123", confirmPassword: "NewPassword@123" });

      const res = await request(app)
        .patch(`/api/auth/reset-password/${plainToken}`)
        .send({ newPassword: "AnotherPassword@123", confirmPassword: "AnotherPassword@123" });

      expect(res.statusCode).toBe(400);
    });
  });

  // ───────────────────────────────────────
  // EMAIL VERIFICATION
  // ───────────────────────────────────────
  describe("GET /api/auth/verify-email/:token", () => {
    it("should mark a new user as unverified by default", async () => {
      const { user } = await registerAndLogin();
      expect(user.isEmailVerified).toBe(false);
    });

    it("should verify email with a valid token", async () => {
      await registerAndLogin();
      const user = await User.findOne({ email: global.TEST_USER.email });
      const plainToken = user.createEmailVerificationToken();
      await user.save({ validateBeforeSave: false });

      const res = await request(app).get(`/api/auth/verify-email/${plainToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.isEmailVerified).toBe(true);

      const updated = await User.findOne({ email: global.TEST_USER.email });
      expect(updated.isEmailVerified).toBe(true);
    });

    it("should reject an invalid/unknown token", async () => {
      const res = await request(app).get(
        `/api/auth/verify-email/${"a".repeat(64)}`,
      );

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/invalid or has expired/i);
    });

    it("should reject a malformed token", async () => {
      const res = await request(app).get(
        "/api/auth/verify-email/not-a-valid-token",
      );

      expect(res.statusCode).toBe(400);
    });

    it("should reject an expired token", async () => {
      await registerAndLogin();
      const user = await User.findOne({ email: global.TEST_USER.email });
      const plainToken = user.createEmailVerificationToken();
      user.emailVerificationExpires = Date.now() - 1000; // force expiry
      await user.save({ validateBeforeSave: false });

      const res = await request(app).get(`/api/auth/verify-email/${plainToken}`);

      expect(res.statusCode).toBe(400);
    });

    it("should not allow reusing the same verification token twice", async () => {
      await registerAndLogin();
      const user = await User.findOne({ email: global.TEST_USER.email });
      const plainToken = user.createEmailVerificationToken();
      await user.save({ validateBeforeSave: false });

      await request(app).get(`/api/auth/verify-email/${plainToken}`);
      const res = await request(app).get(`/api/auth/verify-email/${plainToken}`);

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/auth/resend-verification", () => {
    it("should resend a verification email for an unverified user", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .post("/api/auth/resend-verification")
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should reject if the email is already verified", async () => {
      const { token } = await registerAndLogin();
      const user = await User.findOne({ email: global.TEST_USER.email });
      const plainToken = user.createEmailVerificationToken();
      await user.save({ validateBeforeSave: false });
      await request(app).get(`/api/auth/verify-email/${plainToken}`);

      const res = await request(app)
        .post("/api/auth/resend-verification")
        .set(authHeader(token));

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already verified/i);
    });

    it("should reject unauthenticated requests", async () => {
      const res = await request(app).post("/api/auth/resend-verification");

      expect(res.statusCode).toBe(401);
    });
  });

  // ───────────────────────────────────────
  // LOGOUT
  // ───────────────────────────────────────
  describe("POST /api/auth/logout", () => {
    it("should logout successfully and clear cookie", async () => {
      const { token } = await registerAndLogin();

      const res = await request(app)
        .post("/api/auth/logout")
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);

      const cookies = res.headers["set-cookie"];
      expect(cookies.some((c) => c.includes("jwt=loggedout"))).toBe(true);
    });
  });

  // ───────────────────────────────────────
  // DELETE ACCOUNT (SOFT DELETE)
  // ───────────────────────────────────────
  describe("DELETE /api/auth/me", () => {
    it("should soft delete account (isActive: false)", async () => {
      const { token, user } = await registerAndLogin();

      const res = await request(app)
        .delete("/api/auth/me")
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);

      // verify user is hidden from normal queries (pre-find hook excludes isActive: false)
      const foundUser = await User.findById(user._id);
      expect(foundUser).toBeNull();
    });

    it("should not allow login after account deactivation", async () => {
      const { token } = await registerAndLogin();

      await request(app).delete("/api/auth/me").set(authHeader(token));

      const res = await request(app).post("/api/auth/login").send({
        email: global.TEST_USER.email,
        password: global.TEST_USER.password,
      });

      // deactivated users excluded from find queries — login fails
      expect(res.statusCode).toBe(401);
    });
  });
});
