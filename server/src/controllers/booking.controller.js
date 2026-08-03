"use strict";

const Booking = require("../models/Booking.model");
const Package = require("../models/Package.model");
const Camera = require("../models/Camera.model");
const Availability = require("../models/Availability.model");
const { AppError } = require("../middlewares/error.middleware");
const { sendSuccess, STATUS, paginationMeta } = require("../utils/apiResponse");
const { cacheDeletePattern, CACHE_KEYS } = require("../config/redis");
const { sendRescheduleConfirmation } = require("../services/email.service");
const { processCancellationRefund } = require("../services/razorpay.service");
const {
  emitBookingRescheduled,
  emitBookingInProgress,
  emitBookingCompleted,
  emitAdminActivity,
} = require("../socket");
const { notifyAdmins } = require("../services/notification.service");

// ─────────────────────────────────────────
// CREATE BOOKING
// POST /api/bookings
// protected — JWT required
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, date, time]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [photography, rental]
 *               packageId:
 *                 type: string
 *                 description: Required if type is photography
 *               cameraId:
 *                 type: string
 *                 description: Required if type is rental
 *               rentalType:
 *                 type: string
 *                 enum: [hourly, daily, weekend]
 *               quantity:
 *                 type: number
 *               accessories:
 *                 type: array
 *                 items: { type: string }
 *               withPhotographer:
 *                 type: boolean
 *               date:
 *                 type: string
 *                 format: date
 *               time:
 *                 type: string
 *                 example: "10:00"
 *               location:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Booking created — proceed to payment
 *       400:
 *         description: Date not available or invalid input
 */
const createBooking = async (req, res, next) => {
  try {
    const {
      type,
      packageId,
      cameraId,
      rentalType,
      rentalQuantity = 1,
      accessories = [],
      withPhotographer = false,
      date,
      endDate,
      time,
      location,
      notes,
    } = req.body;

    const isMultiDay = Boolean(endDate);

    // ── 1. Load the package/camera being booked ─────────
    // (needed up front — wedding packages get their own availability
    // scope and multi-day rentals need the camera's daily rate)
    let pkg = null;
    let camera = null;

    if (type === "photography") {
      pkg = await Package.findById(packageId);
      if (!pkg) {
        return next(new AppError("Package not found", STATUS.NOT_FOUND));
      }
    } else if (type === "rental") {
      camera = await Camera.findById(cameraId);
      if (!camera) {
        return next(new AppError("Camera not found", STATUS.NOT_FOUND));
      }
      if (!camera.isAvailable) {
        return next(
          new AppError(
            `Camera is not available: ${camera.unavailabilityReason}`,
            STATUS.BAD_REQUEST,
          ),
        );
      }
    }

    const isWeddingPackage = type === "photography" && pkg.category === "wedding";
    const availabilityScope = isWeddingPackage ? "wedding" : "general";

    // multi-day date ranges only make sense for wedding packages
    // (on-site the whole time) and camera rentals (item held for days)
    if (isMultiDay && type === "photography" && !isWeddingPackage) {
      return next(
        new AppError(
          "Multi-day date ranges are only available for wedding/marriage packages",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // ── 2. Check date availability ─────────
    const availability = isMultiDay
      ? await Availability.checkDateRange(date, endDate, availabilityScope)
      : await Availability.checkDate(date, availabilityScope);

    if (!availability.available) {
      return next(
        new AppError(
          isMultiDay
            ? `Some dates in this range are not available: ${availability.reason}`
            : `Date ${date} is not available: ${availability.reason}`,
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // ── 3. Check 48hr advance rule (against the start date) ─────────
    const shootDate = new Date(date);
    const hoursUntilShoot = (shootDate - new Date()) / (1000 * 60 * 60);
    if (hoursUntilShoot < 48) {
      return next(
        new AppError(
          "Bookings must be made at least 48 hours in advance",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // ── 4. Build booking data ──────────────
    let bookingData = {
      user: req.user._id,
      type,
      date: shootDate,
      endDate: isMultiDay ? new Date(endDate) : null,
      isMultiDay,
      availabilityScope,
      // multi-day bookings (wedding on-site, multi-day rentals) never
      // use a time slot — presence/possession is for the whole span
      time: isMultiDay ? undefined : time,
      location: location || "",
      notes: notes || "",
      amount: { subtotal: 0, total: 0, currency: "INR" },
    };

    if (type === "photography") {
      // snapshot package details at booking time
      bookingData.package = pkg._id;
      bookingData.packageSnapshot = {
        name: pkg.name,
        category: pkg.category,
        type: pkg.type,
        includes: pkg.includes,
        duration: pkg.duration,
      };

      // set amount — flat package price, regardless of how many days
      // the wedding coverage spans
      bookingData.amount = {
        subtotal: pkg.price.amount,
        total: pkg.price.amount,
        currency: "INR",
      };
    } else if (type === "rental") {
      // multi-day rentals are always billed at the daily rate,
      // quantity = number of days in the selected range
      const effectiveRentalType = isMultiDay ? "daily" : rentalType;
      const effectiveQuantity = isMultiDay
        ? Math.round((new Date(endDate) - shootDate) / (1000 * 60 * 60 * 24)) + 1
        : rentalQuantity;

      // calculate rental cost
      const costBreakdown = camera.calculateRentalCost(
        effectiveRentalType,
        effectiveQuantity,
        accessories,
        withPhotographer,
      );

      // snapshot camera details
      bookingData.camera = camera._id;
      bookingData.cameraSnapshot = {
        name: camera.name,
        brand: camera.brand,
        model: camera.model,
        imageUrl: camera.image.url,
        dailyRate: camera.rentalRates.daily,
      };
      bookingData.rentalType = effectiveRentalType;
      bookingData.rentalQuantity = effectiveQuantity;
      bookingData.selectedAccessories = accessories;
      bookingData.withPhotographer = withPhotographer;

      // set amount breakdown
      bookingData.amount = {
        subtotal: costBreakdown.baseCost,
        accessoryCost: costBreakdown.accessoryCost,
        photographerCost: costBreakdown.photographerCost,
        securityDeposit: costBreakdown.securityDeposit,
        total: costBreakdown.total,
        currency: "INR",
      };
    }

    // ── 5. Create booking ──────────────────
    const booking = await Booking.create(bookingData);

    console.log(
      `✅ Booking created → ${booking.bookingRef} | User: ${req.user.email} | ₹${booking.amount.total}`,
    );

    const io = req.app.get("io");
    if (io) {
      emitAdminActivity(io, "booking:created", {
        bookingId: booking._id,
        bookingRef: booking.bookingRef,
        type: booking.type,
        amount: booking.amount.total,
        customer: req.user.name,
      });
    }

    // fire-and-forget — never block the booking response on this
    notifyAdmins(
      io,
      "booking_created",
      "New Booking",
      `${req.user.name} booked ${
        booking.type === "photography"
          ? booking.packageSnapshot?.name || "a session"
          : booking.cameraSnapshot?.name || "a rental"
      } for ${booking.date.toDateString()}`,
      { bookingId: booking._id, bookingRef: booking.bookingRef },
    );

    return sendSuccess(
      res,
      STATUS.CREATED,
      "Booking created. Proceed to payment to confirm.",
      {
        bookingId: booking._id,
        bookingRef: booking.bookingRef,
        status: booking.status,
        amount: booking.amount,
        date: booking.date,
        endDate: booking.endDate,
        isMultiDay: booking.isMultiDay,
        time: booking.time,
        type: booking.type,
      },
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET MY BOOKINGS
// GET /api/bookings/my
// protected
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/bookings/my:
 *   get:
 *     summary: Get current user's bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Payment Done, Confirmed, In Progress, Completed, Cancelled]
 *     responses:
 *       200:
 *         description: User bookings fetched
 */
const getMyBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("package", "name category type includes")
        .populate("camera", "name brand model image accessories")
        .select("-payment.razorpaySignature -statusHistory"),
      Booking.countDocuments(filter),
    ]);

    const meta = paginationMeta(total, page, limit);

    return sendSuccess(
      res,
      STATUS.OK,
      "Bookings fetched successfully",
      bookings,
      meta,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET BOOKING BY ID
// GET /api/bookings/:id
// protected — only owner can view
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Get a single booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Booking fetched
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Booking not found
 */
const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("package", "name category type price includes")
      .populate("camera", "name brand model image specs rentalRates accessories")
      .populate("user", "name email phone")
      .select("-payment.razorpaySignature");

    if (!booking) {
      return next(new AppError("Booking not found", STATUS.NOT_FOUND));
    }

    // ownership check — admins can view any booking
    if (
      req.user.role !== "admin" &&
      booking.user._id.toString() !== req.user._id.toString()
    ) {
      return next(
        new AppError(
          "You are not authorized to view this booking",
          STATUS.FORBIDDEN,
        ),
      );
    }

    return sendSuccess(res, STATUS.OK, "Booking fetched", booking);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// RESCHEDULE BOOKING
// PATCH /api/bookings/:id/reschedule
// protected — owner only
// rules: within 24hrs of booking, new date from availability
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/bookings/{id}/reschedule:
 *   patch:
 *     summary: Reschedule a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newDate, newTime]
 *             properties:
 *               newDate:
 *                 type: string
 *                 format: date
 *               newTime:
 *                 type: string
 *                 example: "14:00"
 *     responses:
 *       200:
 *         description: Booking rescheduled
 *       400:
 *         description: Reschedule not allowed
 */
const rescheduleBooking = async (req, res, next) => {
  try {
    const { newDate, newTime } = req.body;

    const booking = await Booking.findById(req.params.id).populate(
      "user",
      "name email",
    );

    if (!booking) {
      return next(new AppError("Booking not found", STATUS.NOT_FOUND));
    }

    // ── Ownership check ────────────────────
    if (booking.user._id.toString() !== req.user._id.toString()) {
      return next(
        new AppError(
          "You are not authorized to reschedule this booking",
          STATUS.FORBIDDEN,
        ),
      );
    }

    // ── Reschedulable check (virtual) ──────
    if (!booking.isReschedulable) {
      if (booking.isMultiDay) {
        return next(
          new AppError(
            "Multi-day bookings can't be rescheduled online — please contact us to change your dates",
            STATUS.BAD_REQUEST,
          ),
        );
      }
      if (booking.hasRescheduled) {
        return next(
          new AppError(
            "You have already used your free reschedule for this booking",
            STATUS.BAD_REQUEST,
          ),
        );
      }
      if (!["Confirmed", "Payment Done"].includes(booking.status)) {
        return next(
          new AppError(
            `Booking cannot be rescheduled at this stage: ${booking.status}`,
            STATUS.BAD_REQUEST,
          ),
        );
      }
      const hoursLeft =
        (new Date(booking.date) - new Date()) / (1000 * 60 * 60);
      if (hoursLeft <= 24) {
        return next(
          new AppError(
            `Reschedule window has closed. Only ${Math.round(hoursLeft)}hrs left before shoot.`,
            STATUS.BAD_REQUEST,
          ),
        );
      }
    }

    // ── Check if reschedule was made within 24hrs of booking ──
    const bookingAge =
      (new Date() - new Date(booking.createdAt)) / (1000 * 60 * 60);
    if (bookingAge > 24) {
      return next(
        new AppError(
          "Reschedule is only allowed within 24 hours of making the booking",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // ── Check new date availability ────────
    const newAvailability = await Availability.checkDate(
      newDate,
      booking.availabilityScope,
    );
    if (!newAvailability.available) {
      return next(
        new AppError(
          `New date ${newDate} is not available: ${newAvailability.reason}`,
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // ── 48hr advance check for new date ───
    const newShootDate = new Date(newDate);
    const hoursUntilNewShoot = (newShootDate - new Date()) / (1000 * 60 * 60);
    if (hoursUntilNewShoot < 48) {
      return next(
        new AppError(
          "New date must be at least 48 hours from now",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // ── Update availability ────────────────
    // free old date
    const oldAvailability = await Availability.findOne({
      date: new Date(booking.date).setUTCHours(0, 0, 0, 0),
      scope: booking.availabilityScope,
    });
    if (oldAvailability) {
      await oldAvailability.removeBooking(booking._id);
    }

    // book new date
    const newAvailabilityRecord = await Availability.getOrCreate(
      newDate,
      booking.availabilityScope,
    );
    await newAvailabilityRecord.addBooking(booking._id, booking.type, newTime);

    // invalidate availability cache
    await cacheDeletePattern(`${CACHE_KEYS.availability("")}*`);

    // ── Save old date for email/history ───
    const oldDate = booking.date;
    const oldTime = booking.time;

    // ── Update booking ─────────────────────
    booking.rescheduleHistory.push({
      oldDate,
      oldTime,
      newDate: newShootDate,
      newTime,
      rescheduledAt: new Date(),
    });
    booking.hasRescheduled = true;
    booking.date = newShootDate;
    booking.time = newTime;

    await booking.save();

    // ── Send email ─────────────────────────
    sendRescheduleConfirmation(booking.user, booking, oldDate, oldTime);

    // ── Emit WebSocket ─────────────────────
    const io = req.app.get("io");
    if (io) {
      emitBookingRescheduled(
        io,
        booking._id,
        booking.user._id,
        newDate,
        newTime,
      );
    }

    console.log(
      `✅ Booking rescheduled → ${booking.bookingRef} | ${oldDate} → ${newDate}`,
    );

    return sendSuccess(res, STATUS.OK, "Booking rescheduled successfully", {
      bookingId: booking._id,
      bookingRef: booking.bookingRef,
      oldDate,
      oldTime,
      newDate: booking.date,
      newTime: booking.time,
      status: booking.status,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// CANCEL BOOKING
// PATCH /api/bookings/:id/cancel
// protected — owner only
// delegates to razorpay.service for refund
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/bookings/{id}/cancel:
 *   patch:
 *     summary: Cancel a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking cancelled
 *       400:
 *         description: Booking not cancellable
 */
const cancelBooking = async (req, res, next) => {
  try {
    const { reason = "" } = req.body;
    const io = req.app.get("io");

    // delegate to razorpay service — handles refund + status + email + socket
    const { booking, refundAmount, refundInitiated } =
      await processCancellationRefund(req.params.id, req.user._id, reason, io);

    console.log(
      `✅ Booking cancelled → ${booking.bookingRef} | Refund: ₹${refundAmount} | Initiated: ${refundInitiated}`,
    );

    return sendSuccess(res, STATUS.OK, "Booking cancelled successfully", {
      bookingId: booking._id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      refundAmount,
      refundInitiated,
      refundTimeline: refundInitiated ? "5-7 business days" : null,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET OVERDUE BOOKINGS (ADMIN)
// GET /api/bookings/overdue
// admin only — rentals/shoots still out past
// their planned return date, not yet marked
// Completed or Cancelled
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/bookings/overdue:
 *   get:
 *     summary: List bookings currently overdue for return (admin)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue bookings fetched
 */
const getOverdueBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.getOverdueBookings();

    return sendSuccess(res, STATUS.OK, "Overdue bookings fetched", bookings);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// UPDATE BOOKING STATUS (ADMIN)
// PATCH /api/bookings/:id/status
// admin only — mark In Progress / Completed
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/bookings/{id}/status:
 *   patch:
 *     summary: Update booking status (admin)
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [In Progress, Completed]
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 */
const updateBookingStatus = async (req, res, next) => {
  try {
    const { status, note = "" } = req.body;
    const io = req.app.get("io");

    // admin can only set these statuses manually
    const allowedStatuses = ["In Progress", "Completed"];
    if (!allowedStatuses.includes(status)) {
      return next(
        new AppError(
          `Admin can only set status to: ${allowedStatuses.join(", ")}`,
          STATUS.BAD_REQUEST,
        ),
      );
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return next(new AppError("Booking not found", STATUS.NOT_FOUND));
    }

    // validate transition
    const validTransitions = {
      "In Progress": ["Confirmed"],
      Completed: ["In Progress"],
    };

    if (!validTransitions[status]?.includes(booking.status)) {
      return next(
        new AppError(
          `Cannot transition from ${booking.status} to ${status}`,
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // ── Record actual handover event ───────
    // "In Progress" = camera physically collected / shoot started.
    // "Completed"   = camera physically returned / shoot finished —
    // this is also where a late fee is calculated if the item/event
    // ran past its planned return date (see Booking.model.js).
    let handoverResult = { lateFee: 0, overdueDays: 0 };
    if (status === "In Progress") {
      handoverResult = booking.recordHandover("pickedUp");
    } else if (status === "Completed") {
      handoverResult = booking.recordHandover("returned", {
        waiveLateFee: Boolean(req.body.waiveLateFee),
      });
    }

    await booking.updateStatus(
      status,
      note ||
        (handoverResult.lateFee > 0
          ? `Marked as ${status} by admin — ₹${handoverResult.lateFee} late fee applied (${handoverResult.overdueDays} day(s) overdue)`
          : `Marked as ${status} by admin`),
    );

    // emit WebSocket event
    if (io) {
      if (status === "In Progress") {
        emitBookingInProgress(io, booking._id, booking.user);
      } else if (status === "Completed") {
        emitBookingCompleted(io, booking._id, booking.user);
      }
    }

    console.log(
      `✅ Booking status → ${booking.bookingRef}: ${status}` +
        (handoverResult.lateFee > 0 ? ` | Late fee: ₹${handoverResult.lateFee}` : ""),
    );

    return sendSuccess(res, STATUS.OK, `Booking marked as ${status}`, {
      bookingId: booking._id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      handover: booking.handover,
      amount: booking.amount,
      lateFee: handoverResult.lateFee,
      overdueDays: handoverResult.overdueDays,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// ADMIN CANCEL BOOKING
// PATCH /api/bookings/:id/admin-cancel
// admin only — cancel any customer's booking
// (same refund/availability/notification flow
// as a self-service cancel, just without the
// ownership check)
// ─────────────────────────────────────────
const adminCancelBooking = async (req, res, next) => {
  try {
    const { reason = "" } = req.body;
    const io = req.app.get("io");

    const { booking, refundAmount, refundInitiated } =
      await processCancellationRefund(
        req.params.id,
        req.user._id,
        reason || "Cancelled by admin",
        io,
        { isAdmin: true },
      );

    console.log(
      `✅ Booking cancelled by admin → ${booking.bookingRef} | Refund: ₹${refundAmount} | Initiated: ${refundInitiated}`,
    );

    return sendSuccess(res, STATUS.OK, "Booking cancelled successfully", {
      bookingId: booking._id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      refundAmount,
      refundInitiated,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE BOOKING (ADMIN)
// DELETE /api/bookings/:id
// admin only — permanently removes a booking
// record. Only allowed once a booking has
// reached a final state (Completed or
// Cancelled) so nothing active/in-flight can
// be deleted out from under a customer.
// ─────────────────────────────────────────
const deleteBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return next(new AppError("Booking not found", STATUS.NOT_FOUND));
    }

    // ownership check — admins can delete any booking, users only their own
    if (
      req.user.role !== "admin" &&
      booking.user.toString() !== req.user._id.toString()
    ) {
      return next(
        new AppError(
          "You are not authorized to delete this booking",
          STATUS.FORBIDDEN,
        ),
      );
    }

    if (!["Completed", "Cancelled"].includes(booking.status)) {
      return next(
        new AppError(
          "Only completed or cancelled bookings can be deleted",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    const { bookingRef } = booking;
    await booking.deleteOne();

    // invalidate any cached availability/admin views referencing this booking
    await cacheDeletePattern(`${CACHE_KEYS.availability("")}*`);

    const io = req.app.get("io");
    if (io) {
      emitAdminActivity(io, "booking_deleted", {
        message: `Booking ${bookingRef} was deleted`,
        bookingId: req.params.id,
        bookingRef,
      });
    }

    console.log(`🗑️  Booking deleted → ${bookingRef}`);

    return sendSuccess(res, STATUS.OK, "Booking deleted successfully", {
      bookingId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  rescheduleBooking,
  cancelBooking,
  updateBookingStatus,
  adminCancelBooking,
  deleteBooking,
  getOverdueBookings,
};
