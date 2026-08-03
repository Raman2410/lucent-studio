import { useEffect, useCallback } from "react";
import socket from "@/services/socketService";

/**
 * useBookingSocket — subscribe to real-time booking status events.
 *
 * The backend emits booking:statusUpdated to TWO rooms:
 *   1. The user's personal room (userId) — so the bookings list page
 *      can update all bookings without knowing which one changed.
 *   2. The booking-specific room (booking:{id}) — so a detail view
 *      can track exactly one booking. Joining this room requires
 *      emitting booking:join, which the backend validates for auth.
 *
 * This hook handles room 1 (personal room) automatically — you only
 * get events for the logged-in user's own bookings since the socket
 * was authenticated with their JWT. Room 2 is opt-in via `bookingId`.
 *
 * Payload shape from socket.js emitBookingUpdate:
 *   { bookingId, status, updatedAt, message, event, ...extra }
 *   extra fields by event:
 *     booking:confirmed   — (no extra beyond message)
 *     booking:cancelled   — { refundInitiated }
 *     booking:rescheduled — { newDate, newTime }
 *     booking:inProgress  — (no extra)
 *     booking:completed   — (no extra)
 *
 * @param {function} onUpdate   — called with the full payload on every event
 * @param {string}  [bookingId] — optional: also track one specific booking's room
 */
export default function useBookingSocket(onUpdate, bookingId = null) {
  // stable ref so we don't re-register the listener on every render
  const stableOnUpdate = useCallback(onUpdate, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // listen on the personal room — arrives for all user's bookings
    socket.on("booking:statusUpdated", stableOnUpdate);

    // join the booking-specific room if a bookingId was provided
    if (bookingId) {
      socket.emit("booking:join", { bookingId });
    }

    return () => {
      socket.off("booking:statusUpdated", stableOnUpdate);

      // leave the specific room on unmount
      if (bookingId) {
        socket.emit("booking:leave", { bookingId });
      }
    };
  }, [stableOnUpdate, bookingId]);
}
