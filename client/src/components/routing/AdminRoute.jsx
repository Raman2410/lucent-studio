import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * AdminRoute — guards /admin/*. Requires login AND role === "admin",
 * matching the backend's protect + restrictTo("admin") stack on
 * /api/admin/*. Non-admin logged-in users get bounced home instead
 * of to /login, since they ARE authenticated, just not authorized.
 */
export default function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
