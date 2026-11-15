import { PRIORITIES, STATUSES, labelFor } from "../utils/format";

export function PriorityBadge({ priority }) {
  return <span className={`badge badge-priority-${priority}`}>{labelFor(PRIORITIES, priority)}</span>;
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-status-${status}`}>{labelFor(STATUSES, status)}</span>;
}

export function CategoryPill({ category }) {
  if (!category) return null;
  return (
    <span className="category-pill">
      <span className="color-dot" style={{ background: category.color }} aria-hidden="true" />
      {category.name}
    </span>
  );
}
