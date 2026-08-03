import api from "@/lib/api";

/**
 * notificationService — matches server/src/routes/notification.routes.js
 * All routes require auth; each returns only the current user's own
 * notifications (customer or admin — scoped server-side by `recipient`).
 *
 *   GET   /api/notifications?page=&limit=&unreadOnly=
 *   GET   /api/notifications/unread-count
 *   PATCH /api/notifications/:id/read
 *   PATCH /api/notifications/read-all
 */
const notificationService = {
  getMyNotifications: (params = {}) => api.get("/notifications", { params }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch("/notifications/read-all"),
};

export default notificationService;
