"use strict";

const Availability = require("../models/Availability.model");
const { AppError } = require("../middlewares/error.middleware");
const { sendSuccess, STATUS } = require("../utils/apiResponse");
const {
  cacheGet,
  cacheSet,
  cacheDeletePattern,
  CACHE_KEYS,
  CACHE_TTL,
} = require("../config/redis");

// ─────────────────────────────────────────
// SHARED HELPERS — used by both blockDate and unblockDate
// ─────────────────────────────────────────

/**
 * "all" (the default) targets both calendars — the right choice for a
 * photographer marking a personal holiday, since they can't shoot a
 * general session OR a wedding that day. A specific scope targets just
 * that one calendar.
 * @param {string} scope — "general" | "wedding" | "all"
 * @returns {string[]}
 */
const resolveScopes = (scope) => (scope === "all" ? ["general", "wedding"] : [scope]);

/**
 * Invalidate every cached month-calendar entry for a given month.
 * getMonthAvailability caches per scope as "availability:MONTH:scope",
 * so this must be wildcarded rather than deleting the bare "MONTH" key.
 * @param {string} dateStr — "YYYY-MM-DD"
 */
const invalidateMonthCache = async (dateStr) => {
  // dateStr can arrive as a JS Date object (Joi's convert:true turns
  // date strings into real Date objects before they hit the controller)
  // as well as a plain "YYYY-MM-DD" string, so normalize to a string first.
  const normalized =
    dateStr instanceof Date ? dateStr.toISOString() : String(dateStr);
  const month = normalized.slice(0, 7); // "YYYY-MM"
  await cacheDeletePattern(`${CACHE_KEYS.availability(month)}*`);
};

// ─────────────────────────────────────────
// GET MONTH AVAILABILITY
// GET /api/availability/:month
// public — core calendar endpoint
// heavy Redis caching — invalidated on booking changes
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/availability/{month}:
 *   get:
 *     summary: Get availability calendar for a month
 *     tags: [Availability]
 *     parameters:
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           example: "2024-08"
 *         description: Month in YYYY-MM format
 *     responses:
 *       200:
 *         description: Monthly availability fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 month:
 *                   type: string
 *                 dates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Availability'
 *                 summary:
 *                   type: object
 *       400:
 *         description: Invalid month format
 */
const getMonthAvailability = async (req, res, next) => {
  try {
    const { month } = req.params;
    const scope = req.query.scope === "wedding" ? "wedding" : "general";

    // validate month format YYYY-MM
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthRegex.test(month)) {
      return next(
        new AppError(
          "Invalid month format. Use YYYY-MM (e.g. 2024-08)",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // prevent fetching too far in the past
    const [year, monthNum] = month.split("-").map(Number);
    const requestedDate = new Date(year, monthNum - 1, 1);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (requestedDate < oneYearAgo) {
      return next(
        new AppError(
          "Cannot fetch availability for dates more than 1 year in the past",
          STATUS.BAD_REQUEST,
        ),
      );
    }

    // ── Redis cache check ──────────────────
    const cacheKey = `${CACHE_KEYS.availability(month)}:${scope}`;
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return sendSuccess(
        res,
        STATUS.OK,
        `Availability for ${month} (cached)`,
        cached,
      );
    }

    // ── DB query ───────────────────────────
    const availabilityRecords = await Availability.getMonthAvailability(month, scope);

    // ── Build full month calendar ──────────
    // fill in all days — dates with no DB record = fully available
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const fullCalendar = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dateObj = new Date(Date.UTC(year, monthNum - 1, day));

      // find matching DB record
      const record = availabilityRecords.find((r) => {
        const recDateStr = r.date.toISOString().split("T")[0];
        return recDateStr === dateStr;
      });

      // past dates are always blocked on calendar
      const isPast = dateObj < new Date(new Date().setUTCHours(0, 0, 0, 0));

      fullCalendar.push({
        date: dateStr,
        isBlocked: isPast || (record?.isBlocked ?? false),
        isPast,
        blockType: isPast ? "past" : (record?.blockType ?? null),
        reason: isPast ? "Past date" : (record?.reason ?? ""),
        bookingCount: record?.bookingCount ?? 0,
        maxBookingsPerDay: record?.maxBookingsPerDay ?? 3,
        remainingSlots: isPast ? 0 : (record?.remainingSlots ?? 3),
        isAdminBlocked: record?.isAdminBlocked ?? false,
      });
    }

    // ── Month summary ──────────────────────
    const summary = {
      month,
      totalDays: daysInMonth,
      availableDays: fullCalendar.filter((d) => !d.isBlocked).length,
      blockedDays: fullCalendar.filter((d) => d.isBlocked).length,
      pastDays: fullCalendar.filter((d) => d.isPast).length,
      fullyBookedDays: fullCalendar.filter(
        (d) => d.isBlocked && d.blockType === "booking",
      ).length,
      adminBlockedDays: fullCalendar.filter((d) => d.isAdminBlocked).length,
    };

    const responseData = {
      month,
      scope,
      calendar: fullCalendar,
      summary,
    };

    // ── Cache result (1 hour TTL) ──────────
    await cacheSet(cacheKey, responseData, CACHE_TTL.availability);

    return sendSuccess(
      res,
      STATUS.OK,
      `Availability for ${month}`,
      responseData,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// CHECK SINGLE DATE AVAILABILITY
// GET /api/availability/check?date=YYYY-MM-DD
// public — used before booking form submission
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/availability/check:
 *   get:
 *     summary: Check availability for a specific date
 *     tags: [Availability]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           example: "2024-08-15"
 *     responses:
 *       200:
 *         description: Date availability status
 */
const checkDateAvailability = async (req, res, next) => {
  try {
    const { date } = req.query;
    const scope = req.query.scope === "wedding" ? "wedding" : "general";

    if (!date) {
      return next(new AppError("Date is required", STATUS.BAD_REQUEST));
    }

    // validate date format
    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!dateRegex.test(date)) {
      return next(
        new AppError("Invalid date format. Use YYYY-MM-DD", STATUS.BAD_REQUEST),
      );
    }

    // check if date is in the past
    const targetDate = new Date(date);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (targetDate < today) {
      return sendSuccess(res, STATUS.OK, "Date availability checked", {
        date,
        available: false,
        reason: "Past date",
        remainingSlots: 0,
      });
    }

    // check 48hr advance booking rule
    const hoursUntilDate = (targetDate - new Date()) / (1000 * 60 * 60);
    if (hoursUntilDate < 48) {
      return sendSuccess(res, STATUS.OK, "Date availability checked", {
        date,
        available: false,
        reason: "Bookings must be made at least 48 hours in advance",
        remainingSlots: 0,
      });
    }

    const availability = await Availability.checkDate(date, scope);

    return sendSuccess(res, STATUS.OK, "Date availability checked", {
      date,
      scope,
      ...availability,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// CHECK DATE RANGE AVAILABILITY
// GET /api/availability/check-range?startDate=&endDate=&scope=
// public — used before submitting a multi-day booking
// (wedding packages, multi-day camera rentals)
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/availability/check-range:
 *   get:
 *     summary: Check availability across a date range
 *     tags: [Availability]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, example: "2024-08-15" }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, example: "2024-08-17" }
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [general, wedding] }
 *     responses:
 *       200:
 *         description: Range availability status
 */
const checkRangeAvailability = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const scope = req.query.scope === "wedding" ? "wedding" : "general";

    if (!startDate || !endDate) {
      return next(
        new AppError("startDate and endDate are required", STATUS.BAD_REQUEST),
      );
    }

    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return next(
        new AppError("Invalid date format. Use YYYY-MM-DD", STATUS.BAD_REQUEST),
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return next(
        new AppError("End date must be on or after start date", STATUS.BAD_REQUEST),
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (start < today) {
      return sendSuccess(res, STATUS.OK, "Range availability checked", {
        startDate,
        endDate,
        scope,
        available: false,
        reason: "Start date is in the past",
        blockedDates: [],
      });
    }

    // check 48hr advance booking rule against the start date
    const hoursUntilStart = (start - new Date()) / (1000 * 60 * 60);
    if (hoursUntilStart < 48) {
      return sendSuccess(res, STATUS.OK, "Range availability checked", {
        startDate,
        endDate,
        scope,
        available: false,
        reason: "Bookings must be made at least 48 hours in advance",
        blockedDates: [],
      });
    }

    const result = await Availability.checkDateRange(startDate, endDate, scope);

    return sendSuccess(res, STATUS.OK, "Range availability checked", {
      startDate,
      endDate,
      scope,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// BLOCK DATE (ADMIN)
// POST /api/availability/block
// admin only — manually block a date
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/availability/block:
 *   post:
 *     summary: Block a date (admin)
 *     tags: [Availability]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date:
 *                 type: string
 *                 example: "2024-08-15"
 *               reason:
 *                 type: string
 *                 example: "Personal holiday"
 *     responses:
 *       200:
 *         description: Date blocked successfully
 */
const blockDate = async (req, res, next) => {
  try {
    const { date, reason, scope } = req.body;

    // Joi's convert:true (in validate.middleware) turns the incoming
    // "YYYY-MM-DD" string into a real Date object via Joi.date() before
    // it reaches us. Normalize back to a plain date string here so every
    // downstream use (Availability.adminBlock, invalidateMonthCache, the
    // JSON response the frontend renders) works with the same
    // predictable "YYYY-MM-DD" shape.
    const dateStr = date instanceof Date ? date.toISOString().slice(0, 10) : date;

    // validate date is not in the past
    const targetDate = new Date(dateStr);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (targetDate < today) {
      return next(new AppError("Cannot block a past date", STATUS.BAD_REQUEST));
    }

    // "all" (the default) blocks both calendars — the right choice for
    // a photographer marking a personal holiday, since they can't shoot
    // a general session OR a wedding that day. Pass scope explicitly to
    // block just one calendar instead.
    const scopesToBlock = resolveScopes(scope);
    const records = await Promise.all(
      scopesToBlock.map((s) => Availability.adminBlock(dateStr, reason, s)),
    );

    // invalidate Redis cache for this month — getMonthAvailability caches
    // per scope as "availability:MONTH:scope", so the plain unsuffixed
    // key must be wildcarded to actually hit those entries
    await invalidateMonthCache(dateStr);

    console.log(`🚫 Date blocked → ${dateStr} [${scopesToBlock.join(", ")}] | Reason: ${reason || "No reason"}`);

    const [primary] = records;
    return sendSuccess(res, STATUS.OK, `Date ${dateStr} blocked successfully`, {
      date: dateStr,
      scope: scopesToBlock,
      isBlocked: primary.isBlocked,
      blockType: primary.blockType,
      reason: primary.reason,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// UNBLOCK DATE (ADMIN)
// DELETE /api/availability/unblock/:date
// admin only — unblock a manually blocked date
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/availability/unblock/{date}:
 *   delete:
 *     summary: Unblock a date (admin)
 *     tags: [Availability]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           example: "2024-08-15"
 *     responses:
 *       200:
 *         description: Date unblocked successfully
 *       404:
 *         description: No availability record found for this date
 */
const unblockDate = async (req, res, next) => {
  try {
    const { date } = req.params;
    const { scope } = req.query;

    const scopesToUnblock = resolveScopes(scope);
    const results = await Promise.all(
      scopesToUnblock.map((s) => Availability.adminUnblock(date, s)),
    );
    const records = results.filter(Boolean);

    if (records.length === 0) {
      return next(
        new AppError(
          `No availability record found for date: ${date}`,
          STATUS.NOT_FOUND,
        ),
      );
    }

    // invalidate Redis cache for this month (all scopes — see note above)
    await invalidateMonthCache(date);

    const stillBlocked = records.some((r) => r.isBlocked);
    const statusMsg = stillBlocked
      ? "Date still blocked due to existing bookings"
      : "Date unblocked successfully";

    console.log(`✅ Date unblocked → ${date} | Status: ${statusMsg}`);

    const [primary] = records;
    return sendSuccess(res, STATUS.OK, statusMsg, {
      date,
      scope: scopesToUnblock,
      isBlocked: stillBlocked,
      blockType: primary.blockType,
      bookingCount: primary.bookingCount,
      remainingSlots: primary.remainingSlots,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET BLOCKED DATES
// GET /api/availability/blocked
// admin — list all admin-blocked dates
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/availability/blocked:
 *   get:
 *     summary: Get all admin-blocked dates
 *     tags: [Availability]
 *     responses:
 *       200:
 *         description: Blocked dates fetched
 */
const getBlockedDates = async (req, res, next) => {
  try {
    const blockedDates = await Availability.find({
      isAdminBlocked: true,
      date: { $gte: new Date() }, // only future blocked dates
    })
      .sort({ date: 1 })
      .select("date scope reason adminBlock bookingCount");

    return sendSuccess(res, STATUS.OK, "Blocked dates fetched", blockedDates);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMonthAvailability,
  checkDateAvailability,
  checkRangeAvailability,
  blockDate,
  unblockDate,
  getBlockedDates,
};
