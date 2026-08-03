import api from "@/lib/api";

/**
 * cameraService — matches server/src/routes/camera.routes.js
 *
 * Public:
 *   GET  /api/cameras
 *   GET  /api/cameras/:id
 *   GET  /api/cameras/:id/availability?month=YYYY-MM
 *   POST /api/cameras/:id/calculate
 *
 * Admin (JWT + role "admin" required):
 *   POST   /api/cameras                         (multipart — image + accessories[])
 *   PATCH  /api/cameras/:id                     (JSON only)
 *   PATCH  /api/cameras/:id/toggle-availability
 *   DELETE /api/cameras/:id
 */
const cameraService = {
  getAll: (params = {}) => api.get("/cameras", { params }),
  getById: (id) => api.get(`/cameras/${id}`),
  getAvailability: (id, month) =>
    api.get(`/cameras/${id}/availability`, { params: { month } }),
  calculateCost: (id, payload) => api.post(`/cameras/${id}/calculate`, payload),

  // ── admin ──

  /**
   * payload: {
   *   name, brand, model, description,
   *   sensorType, megapixels, videoResolution, isoRange, autofocusPoints,
   *   batteryLife, bodyType, mountType,
   *   hourlyRate, dailyRate, weekendRate,
   *   photographerAddonAvailable, photographerChargePerHour,
   *   securityDeposit, idProofRequired, rentalNotes,
   *   image: File,
   *   accessories: [{ name, description, additionalCharge }],
   *   accessoryImages: File[]  (same order as accessories)
   * }
   */
  create: (payload) => {
    const fd = new FormData();
    const { image, accessories, accessoryImages, ...rest } = payload;
    Object.entries(rest).forEach(([key, value]) => {
      if (value !== undefined && value !== null) fd.append(key, value);
    });
    if (accessories) {
      fd.append(
        "accessories",
        JSON.stringify(accessories.map(({ name, description, additionalCharge }) => ({
          name,
          description,
          additionalCharge,
        })))
      );
    }
    if (image) fd.append("image", image);
    (accessoryImages || []).forEach((f) => f && fd.append("accessories", f));
    return api.post("/cameras", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  update: (id, updates) => api.patch(`/cameras/${id}`, updates),

  toggleAvailability: (id, reason) =>
    api.patch(`/cameras/${id}/toggle-availability`, reason ? { reason } : {}),

  remove: (id) => api.delete(`/cameras/${id}`),
};

export default cameraService;
