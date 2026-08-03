import api from "@/lib/api";

/**
 * packageService — matches server/src/routes/package.routes.js
 *
 * Public:
 *   GET  /api/packages
 *   GET  /api/packages/grouped
 *   GET  /api/packages/popular
 *   GET  /api/packages/category/:category
 *   GET  /api/packages/:id
 *
 * Admin (JWT + role "admin" required):
 *   POST   /api/packages
 *   PATCH  /api/packages/:id
 *   DELETE /api/packages/:id   (soft delete — isActive: false)
 */
const packageService = {
  getAll: (params = {}) => api.get("/packages", { params }),
  getGrouped: () => api.get("/packages/grouped"),
  getPopular: () => api.get("/packages/popular"),
  getByCategory: (category) => api.get(`/packages/category/${category}`),
  getById: (id) => api.get(`/packages/${id}`),

  // ── admin ──
  create: (payload) => api.post("/packages", payload),
  update: (id, payload) => api.patch(`/packages/${id}`, payload),
  remove: (id) => api.delete(`/packages/${id}`),
};

export default packageService;
