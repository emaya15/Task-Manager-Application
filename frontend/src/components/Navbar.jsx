import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/tasks", label: "Tasks" },
  { to: "/board", label: "Board" },
  { to: "/categories", label: "Categories" },
  { to: "/profile", label: "Profile" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    toast.info("You have been logged out.");
    navigate("/login", { replace: true });
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/dashboard" className="brand" onClick={closeMenu}>
          <span className="brand-mark" aria-hidden="true">
            ✓
          </span>
          Task Manager
        </NavLink>

        <button
          type="button"
          className="icon-btn navbar-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>

        <nav className={`navbar-menu${menuOpen ? " open" : ""}`} aria-label="Main">
          <ul className="nav-links">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={closeMenu}
                  className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="navbar-user">
            <ThemeToggle />
            <span className="navbar-username" title={user?.email}>
              {user?.first_name || user?.email}
            </span>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? "Logging out…" : "Logout"}
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
