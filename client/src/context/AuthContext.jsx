import { createContext, useContext, useState, useCallback, useEffect } from "react";
import authService from "@/services/authService";
import socket from "@/services/socketService";

const AuthContext = createContext(null);

/**
 * AuthProvider — single source of truth for "who is logged in".
 * Also owns the Socket.io connection lifecycle — the socket connects
 * after a successful login (token is in localStorage by that point,
 * so socket.js's auth middleware will find it) and disconnects on
 * logout. This means the user is always in their personal socket room
 * (userId) while authenticated, and not connected at all when logged
 * out — no idle open connections for guests.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // connect socket on mount if already authenticated (page refresh)
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token && !socket.connected) {
      socket.connect();
    }
    // don't disconnect on unmount — AuthProvider lives for the whole
    // app lifetime, unmounting means the page is closing anyway
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.login({ email, password });
      setUser(res.data.user);
      // authService.login already persisted the token to localStorage —
      // connect now so the auth header is available to socket.js
      socket.connect();
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async ({ name, email, password, phone }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.register({ name, email, password, phone });
      setUser(res.data.user);
      socket.connect();
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    socket.disconnect(); // leave personal room before clearing the token
    await authService.logout();
    setUser(null);
  }, []);

  const changePassword = useCallback(async ({ currentPassword, newPassword, confirmPassword }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.changePassword({ currentPassword, newPassword, confirmPassword });
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email) => {
    setLoading(true);
    setError(null);
    try {
      return await authService.forgotPassword({ email });
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async ({ token, newPassword, confirmPassword }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.resetPassword({ token, newPassword, confirmPassword });
      setUser(res.data.user);
      // resetPassword logs the user in with a fresh token — bring the
      // socket connection up the same way login()/register() do
      socket.connect();
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyEmail = useCallback(async (token) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.verifyEmail(token);
      // reflect the verified flag on the in-memory user too, if it's the same account
      setUser((prev) =>
        prev && prev.email === res?.data?.user?.email
          ? { ...prev, isEmailVerified: true }
          : prev
      );
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resendVerification = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await authService.resendVerification();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // if another tab logs in or out, mirror it here and sync the socket
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "authToken") {
        if (e.newValue && !socket.connected) socket.connect();
        if (!e.newValue && socket.connected) socket.disconnect();
      }
      if (e.key === "user") {
        setUser(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        error,
        login,
        register,
        logout,
        changePassword,
        forgotPassword,
        resetPassword,
        verifyEmail,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
