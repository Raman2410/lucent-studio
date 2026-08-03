import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNotifications } from "@/context/NotificationContext";
import { getNotificationMeta, formatRelativeTime } from "@/lib/notificationMeta";
import { cn } from "@/lib/utils";

// where each notification type should navigate on click — deep
// links using the small `data` payload the server attaches, routed
// differently for admin vs customer audiences since they land on
// different bookings pages. query_created notifications go to
// admins, who don't yet have a query detail page in this app, so
// no link (avoids a broken route).
function resolveLink(notification) {
  const { audience, data } = notification;
  if (data?.bookingId) {
    return audience === "admin" ? "/admin/bookings" : "/my-bookings";
  }
  return null;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotifications();

  // once read, a notification's job is done — the bell is meant to
  // be "what needs my attention", not a full history. Filtering here
  // (rather than deleting server-side) means the full list is still
  // there if a "notification history" page gets built later.
  const unreadNotifications = notifications.filter((n) => !n.read);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleItemClick = (notification) => {
    if (!notification.read) markAsRead(notification._id);
    const link = resolveLink(notification);
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-all duration-200 hover:border-signature/40 hover:text-signature hover:bg-paper-dim"
      >
        <Bell className="h-4 w-4" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-signature px-1 text-[10px] font-mono font-medium text-paper">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-hidden flex flex-col bg-paper border border-line rounded-lg shadow-lg z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <span className="font-display text-sm font-medium text-ink">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-signature hover:text-signature-soft transition-colors"
                >
                  <CheckCheck className="h-3 w-3" strokeWidth={1.75} />
                  Mark all read
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {loading && unreadNotifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-mist meta-caption">
                  Loading…
                </div>
              ) : unreadNotifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="h-6 w-6 mx-auto mb-2 text-mist-light" strokeWidth={1.25} />
                  <p className="text-xs text-mist">You're all caught up</p>
                </div>
              ) : (
                unreadNotifications.map((n) => {
                  const { icon: Icon, accent } = getNotificationMeta(n.type);
                  return (
                    <button
                      key={n._id}
                      onClick={() => handleItemClick(n)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left border-b border-line/60 last:border-none transition-colors hover:bg-paper-dim",
                        !n.read && "bg-signature-tint/40",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                          accent,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[13px] font-medium text-ink truncate">
                            {n.title}
                          </span>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-signature shrink-0" />
                          )}
                        </span>
                        <span className="block text-xs text-mist mt-0.5 line-clamp-2">
                          {n.message}
                        </span>
                        <span className="block meta-caption text-[10px] text-mist-light mt-1">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
