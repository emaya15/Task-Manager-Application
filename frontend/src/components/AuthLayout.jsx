import ThemeToggle from "./ThemeToggle";

/** Centered card used by the login and register pages. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-card card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            ✓
          </span>
          <span>Task Manager</span>
        </div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
        {footer && <p className="auth-footer">{footer}</p>}
      </div>
    </div>
  );
}
