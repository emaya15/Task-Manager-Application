import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";

/** Login / register pages: logged-in users are redirected to the dashboard. */
export default function PublicRoute() {
  const { isAuthenticated, initializing } = useAuth();

  if (initializing) return <Spinner fullPage label="Loading…" />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
