/**
 * chatService — talks to POST /api/chat, which streams a response
 * via Server-Sent Events rather than returning a normal JSON body.
 *
 * IMPORTANT: this deliberately does NOT go through lib/api.js's
 * axios instance. Axios buffers the whole response before resolving,
 * so it can't hand you tokens as they arrive — only the raw fetch
 * Streams API can. This matches the exact consumption pattern
 * documented in server/src/controllers/chat.controller.js.
 *
 * SSE event shape (one JSON object per `data: ` line):
 *   { type: "delta", content: "..." }               — append to UI
 *   { type: "done", needsEscalation, tokensUsed }    — stream finished
 *   { type: "error", message: "..." }                — something broke
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/**
 * Streams a chat response, calling `onDelta` for each text chunk as
 * it arrives. Resolves with `{ needsEscalation, tokensUsed }` once
 * the stream completes, or throws if the request/stream errors.
 *
 * `signal` (optional AbortSignal) lets the caller cancel mid-stream
 * — used when the widget closes or the user sends a new message
 * before the previous one finished.
 */
export async function streamChatMessage({ message, history = [] }, onDelta, signal) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal,
  });

  if (!response.ok || !response.body) {
    let errMessage = "Couldn't reach the assistant.";
    try {
      const errJson = await response.json();
      errMessage = errJson?.message || errMessage;
    } catch {
      // response wasn't JSON (e.g. proxy error page) — keep default message
    }
    throw new Error(errMessage);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = { needsEscalation: false, tokensUsed: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by blank lines; process complete ones
    // and keep any trailing partial frame in the buffer for next read
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;

      let data;
      try {
        data = JSON.parse(line.slice(6));
      } catch {
        continue; // malformed frame — skip rather than crash the widget
      }

      if (data.type === "delta") {
        onDelta(data.content);
      } else if (data.type === "done") {
        result = { needsEscalation: !!data.needsEscalation, tokensUsed: data.tokensUsed ?? 0 };
      } else if (data.type === "error") {
        throw new Error(data.message || "The assistant hit an error.");
      }
    }
  }

  return result;
}

/** GET /api/chat/health — used to disable the widget gracefully if AI is unconfigured */
export async function getChatHealth() {
  const res = await fetch(`${API_BASE_URL}/chat/health`);
  const json = await res.json();
  return { ok: res.ok, ...json };
}
