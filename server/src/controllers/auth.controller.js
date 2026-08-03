"use strict";

const crypto = require("crypto");
const User = require("../models/User.model");
const { AppError } = require("../middlewares/error.middleware");
const {
  createSendToken,
  clearTokenCookie,
} = require("../middlewares/auth.middleware");
const { sendSuccess, sendError, STATUS } = require("../utils/apiResponse");
const {
  sendEmailVerification,
  sendPasswordReset,
  sendPasswordChanged,
} = require("../services/email.service");

// ─────────────────────────────────────────
// REGISTER
// POST /api/auth/register
// public route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, phone]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Rahul Sharma"
 *               email:
 *                 type: string
 *                 example: "rahul@example.com"
 *               password:
 *                 type: string
 *                 example: "Test@1234"
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Email already exists
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    // check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(
        new AppError(
          "Email already registered. Please login or use a different email.",
          STATUS.CONFLICT,
        ),
      );
    }

    // create user — password hashed in pre-save hook
    const user = await User.create({ name, email, password, phone });

    console.log(`✅ New user registered → ${email}`);

    // generate a verification token and persist it — this write must be
    // AWAITED (not fire-and-forget) before createSendToken runs below.
    // createSendToken sets `user.password = undefined` on this exact
    // in-memory document to strip it from the response; if that mutation
    // happens while this save() is still in flight, it flips
    // isModified("password") to true and the pre-save hook tries to
    // bcrypt.hash(undefined, 12), crashing the save with
    // "Illegal arguments: undefined, number". The save itself is a
    // single local DB write (fast); only the actual network email send
    // below is fire-and-forget, per the lazy-auth / never-block-on-email
    // philosophy.
    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verifyURL = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
    sendEmailVerification(user, verifyURL).catch(() => {});

    // sign JWT + set cookie + send response
    return createSendToken(
      user,
      STATUS.CREATED,
      res,
      "Registration successful",
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// LOGIN
// POST /api/auth/login
// public route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: "rahul@example.com"
 *               password:
 *                 type: string
 *                 example: "Test@1234"
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid email or password
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // fetch user with password (select: false by default) — also pull
    // tokenVersion explicitly so signToken() below embeds the real
    // current value rather than silently defaulting to 0
    const user = await User.findOne({ email }).select(
      "+password +tokenVersion",
    );

    // check user exists AND password is correct
    // combined check prevents email enumeration attacks
    if (!user || !(await user.correctPassword(password))) {
      return next(
        new AppError("Invalid email or password", STATUS.UNAUTHORIZED),
      );
    }

    console.log(`✅ User logged in → ${email}`);

    // sign JWT + set cookie + send response
    return createSendToken(user, STATUS.OK, res, "Login successful");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// VERIFY EMAIL
// GET /api/auth/verify-email/:token
// public route — token itself is the credential
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/verify-email/{token}:
 *   get:
 *     summary: Verify email address using the link sent at registration
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Token invalid or expired
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      return next(
        new AppError(
          "This verification link is invalid or has expired. Please request a new one.",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    console.log(`✅ Email verified → ${user.email}`);

    return sendSuccess(res, STATUS.OK, "Email verified successfully", {
      user,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// RESEND VERIFICATION EMAIL
// POST /api/auth/resend-verification
// protected route — resends to the logged-in user's own address
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend the email verification link to the current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Email is already verified
 */
const resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.isEmailVerified) {
      return next(
        new AppError("This email is already verified.", STATUS.BAD_REQUEST),
      );
    }

    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verifyURL = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
    await sendEmailVerification(user, verifyURL);

    console.log(`✅ Verification email resent → ${user.email}`);

    return sendSuccess(
      res,
      STATUS.OK,
      "Verification email sent. Please check your inbox.",
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// LOGOUT
// POST /api/auth/logout
// protected route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
const logout = async (req, res, next) => {
  try {
    // overwrite JWT cookie with expired value
    clearTokenCookie(res);

    return sendSuccess(res, STATUS.OK, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET CURRENT USER
// GET /api/auth/me
// protected route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current logged in user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *       401:
 *         description: Not authenticated
 */
const getMe = async (req, res, next) => {
  try {
    // req.user attached by protect middleware
    // re-fetch to get fresh data
    const user = await User.findById(req.user._id).populate({
      path: "bookings",
      select: "bookingRef type status date amount createdAt",
      options: { sort: { createdAt: -1 }, limit: 5 },
    });

    if (!user) {
      return next(new AppError("User not found", STATUS.NOT_FOUND));
    }

    return sendSuccess(res, STATUS.OK, "User fetched successfully", { user });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// UPDATE PROFILE
// PATCH /api/auth/me
// protected route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/me:
 *   patch:
 *     summary: Update current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
const updateMe = async (req, res, next) => {
  try {
    // prevent password update via this route
    if (req.body.password || req.body.email) {
      return next(
        new AppError(
          "This route is not for password or email updates. Use /change-password.",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // only allow safe fields to be updated
    const allowedFields = ["name", "phone"];
    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true, // return updated document
      runValidators: true, // run schema validators on update
    });

    return sendSuccess(res, STATUS.OK, "Profile updated successfully", {
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// CHANGE PASSWORD
// PATCH /api/auth/change-password
// protected route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/change-password:
 *   patch:
 *     summary: Change current user password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword, confirmPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Current password is incorrect
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // fetch user with password field — also tokenVersion, so the
    // pre-save hook below increments from the real current value
    // instead of defaulting to undefined→1 every time
    const user = await User.findById(req.user._id).select(
      "+password +tokenVersion",
    );

    // verify current password
    if (!(await user.correctPassword(currentPassword))) {
      return next(
        new AppError("Current password is incorrect", STATUS.UNAUTHORIZED),
      );
    }

    // prevent same password reuse
    if (await user.correctPassword(newPassword)) {
      return next(
        new AppError(
          "New password cannot be the same as current password",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // update password — pre-save hook will hash it
    user.password = newPassword;
    await user.save();

    console.log(`✅ Password changed → ${user.email}`);

    // fire-and-forget confirmation email — never blocks the response
    sendPasswordChanged(user).catch(() => {});

    // issue new JWT — old tokens now invalid
    return createSendToken(
      user,
      STATUS.OK,
      res,
      "Password changed successfully",
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// public route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: "rahul@example.com"
 *     responses:
 *       200:
 *         description: Reset email sent if the account exists
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Always respond with the same generic success message whether or
    // not the account exists — prevents attackers from using this
    // endpoint to enumerate registered emails.
    const genericMessage =
      "If an account exists for that email, a password reset link has been sent.";

    if (!user) {
      return sendSuccess(res, STATUS.OK, genericMessage);
    }

    // generate plain token (emailed) + hashed token (stored)
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    // sendPasswordReset (-> sendEmail) already swallows its own errors
    // and logs them — consistent with the rest of this service, email
    // delivery failure never blocks or changes the API response.
    await sendPasswordReset(user, resetURL);
    console.log(`✅ Password reset requested → ${user.email}`);

    return sendSuccess(res, STATUS.OK, genericMessage);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// RESET PASSWORD
// PATCH /api/auth/reset-password/:token
// public route — token itself is the credential
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   patch:
 *     summary: Reset password using a valid reset token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword, confirmPassword]
 *             properties:
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Token invalid or expired
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // hash the incoming plain token the same way it was hashed at
    // creation time, then look it up — the plain token never touches the DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }, // not yet expired
    }).select(
      "+password +passwordResetToken +passwordResetExpires +tokenVersion",
    );

    if (!user) {
      return next(
        new AppError(
          "Password reset link is invalid or has expired. Please request a new one.",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // set new password — pre-save hook hashes it + updates passwordChangedAt
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    console.log(`✅ Password reset → ${user.email}`);

    // fire-and-forget confirmation email
    sendPasswordChanged(user).catch(() => {});

    // log the user straight in with a fresh token
    return createSendToken(user, STATUS.OK, res, "Password reset successfully");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE ACCOUNT (SOFT DELETE)
// DELETE /api/auth/me
// protected route
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/auth/me:
 *   delete:
 *     summary: Deactivate current user account
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deactivated successfully
 */
const deleteMe = async (req, res, next) => {
  try {
    // soft delete — set isActive to false
    await User.findByIdAndUpdate(req.user._id, { isActive: false });

    // clear JWT cookie
    clearTokenCookie(res);

    console.log(`⚠️  Account deactivated → ${req.user.email}`);

    return sendSuccess(
      res,
      STATUS.OK,
      "Account deactivated successfully. Your data has been retained.",
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  logout,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  deleteMe,
};
