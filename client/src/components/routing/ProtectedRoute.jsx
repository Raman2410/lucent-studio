import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * ProtectedRoute — guards routes that require login (booking,
 * my-bookings), matching the backend's `protect` middleware on
 * those same endpoints. Remembers where the user was headed so
 * Login can send them back after a successful sign-in.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}
