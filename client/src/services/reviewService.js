import api from "@/lib/api";

/**
 * reviewService — matches server/src/routes/review.routes.js
 *
 * Public:
 *   GET /api/reviews/package/:id
 *   GET /api/reviews/camera/:id
 *
 * Protected (JWT required):
 *   POST   /api/reviews                { bookingId, rating, comment }
 *   GET    /api/reviews/my
 *   DELETE /api/reviews/:id
 */
const reviewService = {
  getForPackage: (packageId, params = {}) =>
    api.get(`/reviews/package/${packageId}`, { params }),

  getForCamera: (cameraId, params = {}) =>
    api.get(`/reviews/camera/${cameraId}`, { params }),

  create: ({ bookingId, rating, comment }) =>
    api.post("/reviews", { bookingId, rating, comment }),

  getMine: () => api.get("/reviews/my"),

  remove: (reviewId) => api.delete(`/reviews/${reviewId}`),
};

export default reviewService;
