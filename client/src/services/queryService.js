import api from "@/lib/api";

/**
 * queryService — matches server/src/routes/query.routes.js
 * ALL routes require auth (protect middleware) — api.js attaches
 * the Bearer token automatically once the user is logged in.
 *
 *   POST  /api/queries               submit a help center query
 *   GET   /api/queries/my            list mine (paginated, optional status filter)
 *   GET   /api/queries/:id           single query — includes AI response
 *   PATCH /api/queries/:id/rate      thumbs up/down on the AI response
 *   PATCH /api/queries/:id/close     close a resolved query
 */
const queryService = {
  create: (payload) => api.post("/queries", payload),
  getMyQueries: (params = {}) => api.get("/queries/my", { params }),
  getById: (id) => api.get(`/queries/${id}`),
  rate: (id, wasHelpful) => api.patch(`/queries/${id}/rate`, { wasHelpful }),
  close: (id) => api.patch(`/queries/${id}/close`),
};

export default queryService;
