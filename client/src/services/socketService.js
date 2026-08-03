import { io } from "socket.io-client";

/**
 * socketService — a singleton Socket.io client that the entire app
 * shares. Builds exactly the connection the backend expects:
 *
 * - auth.token:  JWT from localStorage, matching socket.js's
 *               socketAuthMiddleware which checks
 *               socket.handshake.auth?.token first, then
 *               socket.handshake.query?.token.
 *               This puts the socket in the user's personal room
 *               (their userId) so booking:statusUpdated events
 *               arrive on their connection automatically.
 *
 * - autoConnect: false — we call connect() explicitly after login
 *               and disconnect() after logout via AuthContext, so
 *               the socket lifecycle matches the user session.
 *
 * - reconnection: true — socket.js's connectedUsers Map is rebuilt
 *               on each connection, so the server stays in sync
 *               automatically when a tab reconnects.
 *
 * USAGE:
 *   import socket from "@/services/socketService";
 *   socket.connect();           // call on login
 *   socket.disconnect();        // call on logout
 *   socket.on("booking:statusUpdated", cb);
 *   socket.emit("booking:join", { bookingId });
 */
const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  auth: {
    // token is read at connect() time — when the user first logs in
    // it might not be set yet, so we use a getter function which
    // socket.io-client evaluates lazily on each connection/reconnection
    token: () => localStorage.getItem("authToken") || "",
  },
});

// ── dev logging — stripped by Vite in production ──
if (import.meta.env.DEV) {
  socket.on("connect", () =>
    console.log("🔌 Socket connected:", socket.id)
  );
  socket.on("disconnect", (reason) =>
    console.log("❌ Socket disconnected:", reason)
  );
  socket.on("connect_error", (err) =>
    console.warn("⚠️  Socket connect error:", err.message)
  );
}

export default socket;
