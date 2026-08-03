import api from "@/lib/api";

/**
 * authService — thin wrapper around /api/auth/* endpoints.
 * Matches server/src/controllers/auth.controller.js exactly:
 *   POST  /api/auth/register              { name, email, password, phone }
 *   POST  /api/auth/login                 { email, password }
 *   POST  /api/auth/logout
 *   GET   /api/auth/me
 *   PATCH /api/auth/change-password       { currentPassword, newPassword, confirmPassword }
 *   POST  /api/auth/forgot-password       { email }
 *   PATCH /api/auth/reset-password/:token { newPassword, confirmPassword }
 *
 * Every success response has the shape:
 *   { success, message, token, data: { user } }
 * (see auth.middleware.js -> createSendToken)
 */
const authService = {
  register: async ({ name, email, password, phone }) => {
    const res = await api.post("/auth/register", { name, email, password, phone });
    persistSession(res);
    return res;
  },

  login: async ({ email, password }) => {
    const res = await api.post("/auth/login", { email, password });
    persistSession(res);
    return res;
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      clearSession();
    }
  },

  getMe: async () => {
    return api.get("/auth/me");
  },

  // NOTE: backend route is PATCH, not POST — matches auth.routes.js
  changePassword: async ({ currentPassword, newPassword, confirmPassword }) => {
    const res = await api.patch("/auth/change-password", {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    persistSession(res); // password change issues a fresh token
    return res;
  },

  forgotPassword: async ({ email }) => {
    return api.post("/auth/forgot-password", { email });
  },

  resetPassword: async ({ token, newPassword, confirmPassword }) => {
    const res = await api.patch(`/auth/reset-password/${token}`, {
      newPassword,
      confirmPassword,
    });
    persistSession(res); // logs the user straight in with a fresh token
    return res;
  },

  // GET /api/auth/verify-email/:token — public, token is the credential
  verifyEmail: async (token) => {
    const res = await api.get(`/auth/verify-email/${token}`);
    // if the caller is already logged in, refresh the cached user so
    // `isEmailVerified` flips without needing a fresh login
    if (res?.data?.user && localStorage.getItem("authToken")) {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      if (stored?.email === res.data.user.email) {
        localStorage.setItem("user", JSON.stringify({ ...stored, isEmailVerified: true }));
      }
    }
    return res;
  },

  // POST /api/auth/resend-verification — protected, resends to req.user's own email
  resendVerification: async () => {
    return api.post("/auth/resend-verification");
  },
};

// ── local session helpers ──
// Backend already sets the httpOnly cookie itself; we only need to
// mirror the token + user into localStorage so the UI can read
// "who's logged in" synchronously on page load, and so api.js can
// attach the Bearer header.
function persistSession(res) {
  if (res?.token) localStorage.setItem("authToken", res.token);
  if (res?.data?.user) localStorage.setItem("user", JSON.stringify(res.data.user));
}

function clearSession() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
}

export default authService;
