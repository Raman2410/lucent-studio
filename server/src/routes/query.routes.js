"use strict";

const express = require("express");
const router = express.Router();

const {
  createQuery,
  getMyQueries,
  getQueryById,
  rateAiResponse,
  closeQuery,
} = require("../controllers/query.controller");

const { protect } = require("../middlewares/auth.middleware");

const {
  validate,
  querySchemas,
} = require("../middlewares/validate.middleware");

// ─────────────────────────────────────────
// ALL QUERY ROUTES — JWT required
// ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Queries
 *   description: Help center query management
 */

// POST /api/queries — submit a query
router.post("/", protect, validate(querySchemas.create), createQuery);

// GET /api/queries/my — user's own queries
router.get(
  "/my",
  protect,
  validate(querySchemas.myQueriesQuery, "query"),
  getMyQueries,
);

// GET /api/queries/:id
router.get(
  "/:id",
  protect,
  validate(querySchemas.idParam, "params"),
  getQueryById,
);

// PATCH /api/queries/:id/rate — rate AI response
router.patch(
  "/:id/rate",
  protect,
  validate(querySchemas.idParam, "params"),
  rateAiResponse,
);

// PATCH /api/queries/:id/close — close query
router.patch(
  "/:id/close",
  protect,
  validate(querySchemas.idParam, "params"),
  closeQuery,
);

module.exports = router;
