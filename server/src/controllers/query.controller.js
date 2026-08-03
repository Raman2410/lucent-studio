"use strict";

const Query = require("../models/Query.model");
const { AppError } = require("../middlewares/error.middleware");
const { sendSuccess, STATUS, paginationMeta } = require("../utils/apiResponse");
const { sendQueryAcknowledgement } = require("../services/email.service");
const { processQuery } = require("../services/claude.service");
const { notifyAdmins } = require("../services/notification.service");

// ─────────────────────────────────────────
// CREATE QUERY
// POST /api/queries
// protected — JWT required
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/queries:
 *   post:
 *     summary: Submit a help center query
 *     tags: [Queries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, message]
 *             properties:
 *               subject:
 *                 type: string
 *                 example: "Question about wedding package"
 *               message:
 *                 type: string
 *                 example: "Does the premium package include drone shots?"
 *               relatedBookingId:
 *                 type: string
 *                 description: Optional — link query to an existing booking
 *               category:
 *                 type: string
 *                 enum: [booking, packages, rental, payment, technical, general, other]
 *     responses:
 *       201:
 *         description: Query submitted successfully
 */
const createQuery = async (req, res, next) => {
  try {
    const {
      subject,
      message,
      relatedBookingId,
      category = "general",
    } = req.body;

    // ── 1. Create query in DB ──────────────
    const query = await Query.create({
      user: req.user._id,
      subject,
      message,
      relatedBooking: relatedBookingId || null,
      category,
      source: "form",
    });

    // ── 2. Send acknowledgement email ──────
    // fire-and-forget — don't await
    sendQueryAcknowledgement(req.user, query);

    // ── 3. Process with Claude AI ──────────
    // non-blocking — AI processes in background
    // attaches response + updates status automatically
    processQueryWithAI(query._id, subject, message).catch((err) => {
      console.error(
        `❌ AI processing failed for query ${query.queryRef}:`,
        err.message,
      );
    });

    console.log(
      `✅ Query created → ${query.queryRef} | User: ${req.user.email}`,
    );

    // fire-and-forget — never block the response on this
    notifyAdmins(
      req.app.get("io"),
      "query_created",
      "New Contact Query",
      `${req.user.name} asked: "${subject}"`,
      { queryId: query._id, queryRef: query.queryRef },
    );

    return sendSuccess(
      res,
      STATUS.CREATED,
      "Query submitted successfully. Our AI will respond shortly, and our team will follow up if needed.",
      {
        queryId: query._id,
        queryRef: query.queryRef,
        subject: query.subject,
        status: query.status,
        createdAt: query.createdAt,
      },
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// BACKGROUND AI PROCESSOR
// runs after response is sent to user
// fetches fresh query doc, processes with Claude
// attaches AI response + updates status
// ─────────────────────────────────────────
const processQueryWithAI = async (queryId, subject, message) => {
  try {
    // small delay — let DB write settle
    await new Promise((resolve) => setTimeout(resolve, 500));

    const query = await Query.findById(queryId);
    if (!query) return;

    // process with Claude (non-streaming)
    const { response, tokensUsed, needsEscalation } = await processQuery(
      message,
      subject,
    );

    // attach AI response — updates status automatically
    await query.attachAiResponse(response, tokensUsed, needsEscalation);

    console.log(
      `🤖 AI processed query ${query.queryRef} | Escalated: ${needsEscalation} | Tokens: ${tokensUsed}`,
    );
  } catch (error) {
    console.error(`❌ Background AI processing error:`, error.message);
  }
};

// ─────────────────────────────────────────
// GET MY QUERIES
// GET /api/queries/my
// protected
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/queries/my:
 *   get:
 *     summary: Get current user's queries
 *     tags: [Queries]
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
 *           enum: [Open, In Review, Resolved, Closed]
 *     responses:
 *       200:
 *         description: Queries fetched
 */
const getMyQueries = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const [queries, total] = await Promise.all([
      Query.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("relatedBooking", "bookingRef date status type")
        .select("-statusHistory"),
      Query.countDocuments(filter),
    ]);

    const meta = paginationMeta(total, page, limit);

    return sendSuccess(
      res,
      STATUS.OK,
      "Queries fetched successfully",
      queries,
      meta,
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET QUERY BY ID
// GET /api/queries/:id
// protected — owner only
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/queries/{id}:
 *   get:
 *     summary: Get a single query by ID
 *     tags: [Queries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Query fetched
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Query not found
 */
const getQueryById = async (req, res, next) => {
  try {
    const query = await Query.findById(req.params.id)
      .populate("user", "name email")
      .populate("relatedBooking", "bookingRef date status type amount");

    if (!query) {
      return next(new AppError("Query not found", STATUS.NOT_FOUND));
    }

    // ownership check
    if (query.user._id.toString() !== req.user._id.toString()) {
      return next(
        new AppError(
          "You are not authorized to view this query",
          STATUS.FORBIDDEN,
        ),
      );
    }

    return sendSuccess(res, STATUS.OK, "Query fetched", query);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// RATE AI RESPONSE
// PATCH /api/queries/:id/rate
// protected — owner only
// user rates AI response helpful/not helpful
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/queries/{id}/rate:
 *   patch:
 *     summary: Rate the AI response (helpful / not helpful)
 *     tags: [Queries]
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
 *             required: [wasHelpful]
 *             properties:
 *               wasHelpful:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Rating saved
 */
const rateAiResponse = async (req, res, next) => {
  try {
    const { wasHelpful } = req.body;

    if (typeof wasHelpful !== "boolean") {
      return next(
        new AppError("wasHelpful must be a boolean", STATUS.BAD_REQUEST),
      );
    }

    const query = await Query.findById(req.params.id);

    if (!query) {
      return next(new AppError("Query not found", STATUS.NOT_FOUND));
    }

    // ownership check
    if (query.user.toString() !== req.user._id.toString()) {
      return next(
        new AppError(
          "You are not authorized to rate this query",
          STATUS.FORBIDDEN,
        ),
      );
    }

    if (!query.aiResponse?.content) {
      return next(
        new AppError("No AI response to rate yet", STATUS.BAD_REQUEST),
      );
    }

    query.aiResponse.wasHelpful = wasHelpful;
    await query.save();

    console.log(
      `⭐ AI response rated → ${query.queryRef} | Helpful: ${wasHelpful}`,
    );

    return sendSuccess(
      res,
      STATUS.OK,
      "Rating saved. Thank you for your feedback!",
      {
        queryId: query._id,
        wasHelpful,
      },
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// CLOSE QUERY
// PATCH /api/queries/:id/close
// protected — owner only
// user manually closes resolved query
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/queries/{id}/close:
 *   patch:
 *     summary: Close a resolved query
 *     tags: [Queries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Query closed
 *       400:
 *         description: Query must be resolved before closing
 */
const closeQuery = async (req, res, next) => {
  try {
    const query = await Query.findById(req.params.id);

    if (!query) {
      return next(new AppError("Query not found", STATUS.NOT_FOUND));
    }

    // ownership check
    if (query.user.toString() !== req.user._id.toString()) {
      return next(
        new AppError(
          "You are not authorized to close this query",
          STATUS.FORBIDDEN,
        ),
      );
    }

    if (query.status === "Closed") {
      return next(new AppError("Query is already closed", STATUS.BAD_REQUEST));
    }

    if (!["Resolved", "Open", "In Review"].includes(query.status)) {
      return next(
        new AppError(
          `Cannot close a query with status: ${query.status}`,
          STATUS.BAD_REQUEST,
        ),
      );
    }

    await query.updateStatus("Closed", "Closed by user");

    return sendSuccess(res, STATUS.OK, "Query closed successfully", {
      queryId: query._id,
      queryRef: query.queryRef,
      status: query.status,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createQuery,
  getMyQueries,
  getQueryById,
  rateAiResponse,
  closeQuery,
};
