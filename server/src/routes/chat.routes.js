"use strict";

const express = require("express");
const router = express.Router();

const { chat, chatHealth } = require("../controllers/chat.controller");

const { validate, chatSchemas } = require("../middlewares/validate.middleware");

// ─────────────────────────────────────────
// CHAT ROUTES — public (no auth required)
// ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Claude AI streaming chatbot
 */

// GET /api/chat/health — service availability check
router.get("/health", chatHealth);

// POST /api/chat — streaming SSE chat
router.post("/", validate(chatSchemas.message), chat);

module.exports = router;
