"use strict";

const Anthropic = require("@anthropic-ai/sdk");

// ─────────────────────────────────────────
// ANTHROPIC CLIENT
// ─────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────
// CLAUDE MODEL CONFIG
// ─────────────────────────────────────────
const CLAUDE_MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1024;

// ─────────────────────────────────────────
// SYSTEM PROMPT
// tells Claude everything about the studio
// packages, cameras, policies, tone
// ─────────────────────────────────────────
const SYSTEM_PROMPT = `You are a friendly and professional AI assistant for a Photography Studio. 
Your job is to help users with questions about our photography services, camera rentals, bookings, and policies.

## STUDIO OVERVIEW
We are a professional photography studio offering:
- Photography sessions across 5 categories: Wedding & Events, Portrait & Headshots, Commercial & Product, Nature & Landscape, Street & Documentary
- Camera rental services with equipment including DSLRs, Mirrorless cameras, and accessories
- Online booking with real-time availability calendar

## PHOTOGRAPHY PACKAGES

### Wedding & Events
- Basic Package: ₹15,000 — 4 hours, 1 photographer, 200+ edited photos, online gallery
- Standard Package: ₹25,000 — 8 hours, 2 photographers, 500+ edited photos, online gallery
- Premium Package: ₹45,000 — Full day, 2 photographers, 800+ photos + highlights video, USB drive

### Portrait & Headshots
- Basic: ₹3,000 — 1 hour, 50 edited photos
- Standard: ₹5,000 — 2 hours, 100 edited photos, 2 outfit changes
- Premium: ₹9,000 — Half day, 200 edited photos, multiple locations

### Commercial & Product
- Hourly Rate: ₹2,500/hour
- Half Day: ₹10,000 (4 hours)
- Full Day: ₹18,000 (8 hours)

### Nature & Landscape / Street & Documentary
- Custom pricing based on location and requirements
- Contact us for a personalized quote

## CAMERA RENTALS
Available rental durations:
- Hourly: Starting ₹300/hour
- Daily: Starting ₹1,500/day
- Weekend (Fri-Sun): Starting ₹3,500/weekend

Equipment available:
- Sony Alpha Series (A7 III, A7R IV) — Full Frame Mirrorless
- Canon EOS Series (R5, R6) — Mirrorless
- Nikon Z Series (Z6, Z7) — Mirrorless
- Various lenses, tripods, lighting equipment available as add-ons
- Optional photographer add-on available for rentals

Security deposit: ₹5,000 (fully refundable on safe return)
ID proof required for all rentals

## BOOKING POLICIES

### Availability
- Real-time availability calendar on our website
- Maximum 3 sessions per day
- Book at least 48 hours in advance

### Payments
- Full payment required to confirm booking
- Secure payment via Razorpay (cards, UPI, net banking)

### Cancellation & Refund
- Full refund if cancelled 48+ hours before the session
- No refund for cancellations within 48 hours
- Refunds processed in 5-7 business days

### Rescheduling
- One free reschedule allowed within 24 hours of booking
- New date subject to availability
- Contact us immediately if you need to reschedule

## WHAT WE DELIVER
- Edited high-resolution photos (JPEG + RAW on Premium packages)
- Online gallery access for 6 months
- Delivery within 14 working days
- USB drive for Premium packages

## CONTACT & SUPPORT
- Email: studio@photographerstudio.com
- Phone: +91 98765 43210
- Working hours: Mon-Sat, 9 AM - 7 PM IST
- For urgent queries, use this chat or our query form

## YOUR BEHAVIOR GUIDELINES
1. Always be warm, professional, and helpful
2. Answer questions specifically about our studio and services
3. For pricing, give exact figures from the information above
4. If asked about something not covered above, acknowledge it and offer to connect them with our team
5. For booking-specific issues (existing booking problems, payment failures), ask them to submit a query form or call us
6. Never make up information not provided above
7. Keep responses concise but complete — avoid very long responses
8. Use Indian Rupee (₹) for all pricing
9. If the user seems frustrated or has a complex issue, suggest they submit a detailed query to our team
10. ESCALATE to human team when: payment disputes, complaints, legal questions, or anything you're unsure about

## ESCALATION TRIGGER
If you determine the query needs human attention, end your response with exactly this marker on a new line:
[ESCALATE_TO_TEAM]`;

// ─────────────────────────────────────────
// ESCALATION DETECTOR
// checks if Claude flagged the message
// for human team escalation
// ─────────────────────────────────────────
const ESCALATION_MARKER = "[ESCALATE_TO_TEAM]";

const checkEscalation = (content) => {
  const needsEscalation = content.includes(ESCALATION_MARKER);
  const cleanContent = content.replace(ESCALATION_MARKER, "").trim();
  return { needsEscalation, cleanContent };
};

// ─────────────────────────────────────────
// STREAMING CHAT
// streams Claude's response token by token
// via Server-Sent Events (SSE)
// controller passes res object for streaming
// ─────────────────────────────────────────

/**
 * Stream a chat response from Claude
 * Uses SSE — controller must set headers before calling
 *
 * @param {string}   message  — user's message
 * @param {Array}    history  — conversation history [{ role, content }]
 * @param {object}   res      — Express response object (SSE)
 * @returns {object} { fullResponse, tokensUsed, needsEscalation }
 */
const streamChat = async (message, history = [], res) => {
  // build messages array — history + current message
  const messages = [
    ...history.map((h) => ({
      role: h.role,
      content: h.content,
    })),
    {
      role: "user",
      content: message,
    },
  ];

  let fullResponse = "";
  let inputTokens = 0;
  let outputTokens = 0;

  // set SSE headers — must be done before any write
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering

  try {
    // create streaming message
    const stream = await anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
    });

    // stream each text delta to client
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        const text = chunk.delta.text;
        fullResponse += text;

        // send SSE event to client
        // format: "data: {...}\n\n"
        res.write(
          `data: ${JSON.stringify({ type: "delta", content: text })}\n\n`,
        );
      }

      // capture usage from final message
      if (chunk.type === "message_delta" && chunk.usage) {
        outputTokens = chunk.usage.output_tokens;
      }

      if (chunk.type === "message_start" && chunk.message?.usage) {
        inputTokens = chunk.message.usage.input_tokens;
      }
    }

    // check for escalation marker in full response
    const { needsEscalation, cleanContent } = checkEscalation(fullResponse);
    fullResponse = cleanContent;

    // send final SSE event with metadata
    res.write(
      `data: ${JSON.stringify({
        type: "done",
        needsEscalation,
        tokensUsed: inputTokens + outputTokens,
      })}\n\n`,
    );

    // close SSE stream
    res.end();

    return {
      fullResponse,
      tokensUsed: inputTokens + outputTokens,
      needsEscalation,
    };
  } catch (error) {
    // send error event to client
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: "AI service temporarily unavailable. Please try again.",
      })}\n\n`,
    );
    res.end();

    console.error(
      `❌ Claude streaming error: status=${error.status ?? "n/a"} type=${error.error?.error?.type ?? error.name} message=${error.message}`,
    );
    throw error;
  }
};

// ─────────────────────────────────────────
// NON-STREAMING CHAT
// for query processing — when we need
// the full response before saving to DB
// not exposed via API — internal use only
// ─────────────────────────────────────────

/**
 * Get a complete (non-streaming) response from Claude
 * Used when processing query form submissions
 *
 * @param {string} message  — user's query message
 * @param {string} subject  — query subject for context
 * @returns {object} { response, tokensUsed, needsEscalation }
 */
const processQuery = async (message, subject = "") => {
  try {
    const contextMessage = subject
      ? `Query Subject: ${subject}\n\nQuery Message: ${message}`
      : message;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: contextMessage,
        },
      ],
    });

    const content = response.content[0]?.text || "";
    const tokensUsed =
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0);

    const { needsEscalation, cleanContent } = checkEscalation(content);

    return {
      response: cleanContent,
      tokensUsed,
      needsEscalation,
    };
  } catch (error) {
    console.error("❌ Claude processQuery error:", error.message);
    throw new Error("AI service temporarily unavailable");
  }
};

// ─────────────────────────────────────────
// TOKEN COST ESTIMATOR
// rough estimate for monitoring costs
// Claude Sonnet pricing as reference
// ─────────────────────────────────────────

/**
 * Estimate cost of a Claude API call
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {string} estimated cost in USD
 */
const estimateCost = (inputTokens, outputTokens) => {
  // Claude Sonnet 4 pricing (per million tokens)
  const INPUT_COST_PER_M = 3.0; // $3 per million input tokens
  const OUTPUT_COST_PER_M = 15.0; // $15 per million output tokens

  const cost =
    (inputTokens / 1_000_000) * INPUT_COST_PER_M +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_M;

  return `$${cost.toFixed(6)}`;
};

module.exports = {
  streamChat,
  processQuery,
  estimateCost,
  SYSTEM_PROMPT,
  CLAUDE_MODEL,
};
