import { Link } from "react-router-dom";

/** Dashboard number card. Becomes a link when `to` is provided. */
export default function StatCard({ label, value, tone = "neutral", icon, to }) {
  const content = (
    <>
      <span className="stat-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </>
  );
  const className = `stat-card stat-${tone}`;
  return to ? (
    <Link to={to} className={`${className} stat-link`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
