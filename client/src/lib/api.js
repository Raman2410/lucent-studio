import axios from "axios";

/**
 * api — the single axios instance every service file in this app
 * talks through. Two things matter for matching this project's
 * backend exactly:
 *
 * 1. `withCredentials: true` — the backend sets an httpOnly "jwt"
 *    cookie on login/register (see auth.middleware.js -> createSendToken).
 *    Without this flag the browser will silently drop that cookie
 *    on cross-origin requests (localhost:3000 -> localhost:5000).
 *
 * 2. Authorization Bearer header — the backend ALSO accepts a
 *    Bearer token (checked first, before the cookie — see
 *    extractToken() in auth.middleware.js). We store the token
 *    returned at login in localStorage and attach it here, so auth
 *    keeps working even in contexts where cookies get blocked
 *    (Safari ITP, some browser extensions).
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── request interceptor — attach Bearer token if we have one ──
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── response interceptor ──
// The backend's sendSuccess/sendError wrapper (utils/apiResponse.js)
// always returns { success, message, data, meta? }. We unwrap to
// `response.data` here so every service call can just `await` and
// get that payload directly, instead of `.data.data` everywhere.
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message || error.message || "Something went wrong";

    // session expired / not logged in — clear local state.
    // We redirect only outside of the auth pages themselves, so a
    // failed login attempt doesn't bounce the user in a loop.
    if (status === 401 && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
    }

    return Promise.reject({
      message,
      status,
      data: error.response?.data,
    });
  }
);

export default api;
