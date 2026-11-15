/** Previous / Next pagination driven by the API's count + next/previous fields. */
export default function Pagination({ page, count, pageSize, hasNext, hasPrevious, onChange, disabled = false }) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => onChange(page - 1)}
        disabled={disabled || !hasPrevious}
      >
        ← Previous
      </button>
      <span className="pagination-info">
        Page {page} of {totalPages} · {count} task{count === 1 ? "" : "s"}
      </span>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => onChange(page + 1)}
        disabled={disabled || !hasNext}
      >
        Next →
      </button>
    </nav>
  );
}
