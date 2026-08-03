import api from "@/lib/api";

/**
 * photoService — matches server/src/routes/photo.routes.js
 *
 * Public:
 *   GET /api/photos                 (supports ?category, ?featured, ?tag)
 *   GET /api/photos/featured
 *   GET /api/photos/:id
 *
 * Admin (JWT + role "admin" required):
 *   POST   /api/photos/upload
 *   POST   /api/photos/upload/bulk
 *   PATCH  /api/photos/:id
 *   DELETE /api/photos/:id
 *   DELETE /api/photos/bulk
 */
const photoService = {
  getAll: (params = {}) => api.get("/photos", { params }),

  getByCategory: (category, params = {}) =>
    api.get(`/photos/category/${category}`, { params }),

  getFeatured: () => api.get("/photos/featured"),

  getById: (id) => api.get(`/photos/${id}`),

  getByTag: (tag, params = {}) =>
    api.get("/photos", { params: { ...params, tag } }),

  // ── admin ──

  // payload: { file, category, title, description, isFeatured, displayOrder, tags }
  upload: (payload) => {
    const fd = new FormData();
    fd.append("photo", payload.file);
    fd.append("category", payload.category);
    if (payload.title) fd.append("title", payload.title);
    if (payload.description) fd.append("description", payload.description);
    if (payload.isFeatured !== undefined) fd.append("isFeatured", payload.isFeatured);
    if (payload.displayOrder !== undefined) fd.append("displayOrder", payload.displayOrder);
    if (payload.tags) fd.append("tags", payload.tags);
    return api.post("/photos/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // payload: { files: File[], category, startOrder }
  uploadBulk: (payload) => {
    const fd = new FormData();
    payload.files.forEach((f) => fd.append("photos", f));
    fd.append("category", payload.category);
    if (payload.startOrder !== undefined) fd.append("startOrder", payload.startOrder);
    return api.post("/photos/upload/bulk", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  update: (id, updates) => api.patch(`/photos/${id}`, updates),

  remove: (id) => api.delete(`/photos/${id}`),

  removeBulk: (ids) => api.delete("/photos/bulk", { data: { ids } }),
};

export default photoService;
