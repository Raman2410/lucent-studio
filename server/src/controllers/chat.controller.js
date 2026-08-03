"use strict";

const { AppError } = require("../middlewares/error.middleware");
const { sendSuccess, sendError, STATUS } = require("../utils/apiResponse");
const { streamChat } = require("../services/claude.service");

// ─────────────────────────────────────────
// STREAMING CHAT
// POST /api/chat
// public — no auth required for chatbot
// uses SSE (Server-Sent Events) for streaming
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Chat with AI assistant (streaming)
 *     tags: [Chat]
 *     description: |
 *       Streams Claude AI responses token by token via Server-Sent Events (SSE).
 *
 *       **How to consume SSE in frontend:**
 *       ```js
 *       const response = await fetch('/api/chat', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({ message, history })
 *       });
 *
 *       const reader = response.body.getReader();
 *       const decoder = new TextDecoder();
 *
 *       while (true) {
 *         const { done, value } = await reader.read();
 *         if (done) break;
 *
 *         const chunk = decoder.decode(value);
 *         const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
 *
 *         for (const line of lines) {
 *           const data = JSON.parse(line.slice(6));
 *           if (data.type === 'delta')  appendToChat(data.content);
 *           if (data.type === 'done')   handleDone(data.needsEscalation);
 *           if (data.type === 'error')  showError(data.message);
 *         }
 *       }
 *       ```
 *
 *       **SSE Event Types:**
 *       - `delta`  — partial text chunk, append to UI
 *       - `done`   — stream complete, includes `needsEscalation` + `tokensUsed`
 *       - `error`  — something went wrong
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: "What's included in the wedding package?"
 *                 maxLength: 1000
 *               history:
 *                 type: array
 *                 maxItems: 20
 *                 description: Previous conversation turns for context
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: SSE stream — see description for event format
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Missing message
 *       503:
 *         description: AI service unavailable
 */
const chat = async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return next(new AppError("Message is required", STATUS.BAD_REQUEST));
    }

    // sanitize message — trim whitespace
    const sanitizedMessage = message.trim();

    // sanitize history — ensure valid structure
    const sanitizedHistory = history
      .filter(
        (h) =>
          h &&
          typeof h.role === "string" &&
          typeof h.content === "string" &&
          ["user", "assistant"].includes(h.role),
      )
      .slice(-20); // max 20 turns

    console.log(
      `🤖 Chat request | message: "${sanitizedMessage.slice(0, 50)}..." | history: ${sanitizedHistory.length} turns`,
    );

    // streamChat sets SSE headers + streams response
    // res is passed so streamChat can write directly
    const { fullResponse, tokensUsed, needsEscalation } = await streamChat(
      sanitizedMessage,
      sanitizedHistory,
      res,
    );

    // log after stream completes
    console.log(
      `✅ Chat stream complete | tokens: ${tokensUsed} | escalated: ${needsEscalation}`,
    );

    // Note: res.end() is called inside streamChat
    // do not call sendSuccess here — SSE stream is already closed
  } catch (error) {
    // if headers already sent (SSE started) — can't send JSON error
    if (res.headersSent) {
      console.error("❌ Chat error after SSE started:", error.message);
      return;
    }
    next(error);
  }
};

// ─────────────────────────────────────────
// HEALTH CHECK FOR CHAT SERVICE
// GET /api/chat/health
// public — verify Claude API is reachable
// ─────────────────────────────────────────

/**
 * @swagger
 * /api/chat/health:
 *   get:
 *     summary: Check if AI chat service is available
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: Chat service is available
 *       503:
 *         description: Chat service unavailable
 */
const chatHealth = async (req, res, next) => {
  try {
    // quick check — verify API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return sendError(
        res,
        STATUS.SERVICE_UNAVAILABLE,
        "AI chat service is not configured",
      );
    }

    return sendSuccess(res, STATUS.OK, "AI chat service is available", {
      model: "claude-sonnet-4-6",
      streaming: true,
      maxHistoryTurns: 20,
      maxMessageLength: 1000,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chat,
  chatHealth,
};
