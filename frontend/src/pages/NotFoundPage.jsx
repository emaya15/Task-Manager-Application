import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NotFoundPage() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="fullpage-center">
      <div className="card not-found">
        <p className="not-found-code">404</p>
        <h1>Page not found</h1>
        <p className="muted">The page you are looking for does not exist or was moved.</p>
        <Link to={isAuthenticated ? "/dashboard" : "/login"} className="btn btn-primary">
          {isAuthenticated ? "Back to dashboard" : "Go to login"}
        </Link>
      </div>
    </div>
  );
}
