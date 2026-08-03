import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/context/NotificationContext";
import { getNotificationMeta } from "@/lib/notificationMeta";
import { cn } from "@/lib/utils";

/**
 * NotificationToasts — fixed-position stack of live notification
 * popups. Mounted once near the root (App.jsx) so it renders above
 * every page regardless of route. Purely presentational over
 * NotificationContext's `toasts` state — dismissal/auto-expiry logic
 * lives there.
 */
export default function NotificationToasts() {
  const { toasts, dismissToast, markAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (toast) => {
    if (!toast.read) markAsRead(toast._id);
    dismissToast(toast.id);
    if (toast.data?.bookingId) {
      navigate(toast.audience === "admin" ? "/admin/bookings" : "/my-bookings");
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 w-[min(22rem,calc(100vw-2.5rem))]">
      <AnimatePresence>
        {toasts.map((toast) => {
          const { icon: Icon, accent } = getNotificationMeta(toast.type);
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="glass-panel rounded-lg shadow-card p-3.5 flex items-start gap-3 cursor-pointer"
              onClick={() => handleClick(toast)}
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
                <span className="block text-[13px] font-medium text-ink">{toast.title}</span>
                <span className="block text-xs text-mist mt-0.5 line-clamp-2">{toast.message}</span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toast.id);
                }}
                aria-label="Dismiss"
                className="shrink-0 text-mist-light hover:text-ink transition-colors p-0.5"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
