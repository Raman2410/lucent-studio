import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import notificationService from "@/services/notificationService";
import socket from "@/services/socketService";
import { useAuth } from "@/context/AuthContext";

const NotificationContext = createContext(null);

// how many toasts can be visible at once — oldest drops off first
const MAX_TOASTS = 4;
const TOAST_DURATION_MS = 6000;

/**
 * NotificationProvider — single source of truth for in-app
 * notifications (New Booking, Payment Received, Booking Cancelled,
 * New Contact Query, etc.).
 *
 * Two data sources feed the same list:
 *  1. REST fetch on mount/login — the persisted history, so
 *     notifications survive refresh/relogin and work across devices.
 *  2. Socket "notification:new" — live delivery while connected.
 *     The server emits this to the recipient's personal room
 *     (see notification.service.js on the backend), the same room
 *     booking:statusUpdated already uses, so no extra socket wiring
 *     is needed beyond one more `.on()`.
 *
 * Toasts are a transient UI layer on top of this — an incoming
 * live notification both updates the persisted list/badge AND
 * pushes a toast that auto-dismisses.
 */
export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const fetchNotifications = useCallback(async ({ page = 1, limit = 20, silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await notificationService.getMyNotifications({ page, limit });
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
      return res;
    } catch {
      // non-critical — bell just stays empty/stale until next fetch
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const pushToast = useCallback((notification) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { ...notification, id }]);
    setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
  }, [dismissToast]);

  const markAsRead = useCallback(async (id) => {
    // optimistic — bell should feel instant
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await notificationService.markAsRead(id);
    } catch {
      // worst case: re-fetch will correct any drift next time the bell opens
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await notificationService.markAllAsRead();
    } catch {
      // same as above — self-corrects on next fetch
    }
  }, []);

  // fetch history whenever the user logs in; clear on logout
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setToasts([]);
    }
  }, [isAuthenticated, fetchNotifications]);

  // live delivery — same socket connection AuthContext already
  // connects/disconnects around login/logout
  useEffect(() => {
    if (!isAuthenticated) return;

    const onNew = (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
      pushToast(notification);
    };

    socket.on("notification:new", onNew);
    return () => socket.off("notification:new", onNew);
  }, [isAuthenticated, pushToast]);

  // polling fallback — the socket push above is the fast path, but if
  // it's ever missed (dropped connection, reconnect gap, misconfigured
  // socket URL, etc.) there was previously no way to see new
  // notifications short of a manual page refresh. This periodically
  // re-syncs from the server as a safety net, same interval pattern
  // AdminDashboard.jsx already uses for its own live-ish polling.
  useEffect(() => {
    if (!isAuthenticated) return;
    const poll = setInterval(() => fetchNotifications({ silent: true }), 20000);
    return () => clearInterval(poll);
  }, [isAuthenticated, fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        toasts,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        dismissToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}
