import { DUE_FILTERS, ORDERINGS, PRIORITIES, STATUSES } from "../utils/format";

/**
 * Search box + filter selects for the task list.
 * `filters` mirrors the URL query parameters; changes are reported through `onChange(name, value)`.
 */
export default function TaskFilters({ filters, searchInput, onSearchChange, categories, onChange, onClear, hasFilters }) {
  return (
    <section className="card filters" aria-label="Search and filters">
      <div className="filters-search">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search tasks by title or description…"
          aria-label="Search tasks"
        />
      </div>

      <div className="filters-grid">
        <label>
          <span>Status</span>
          <select value={filters.status} onChange={(e) => onChange("status", e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Priority</span>
          <select value={filters.priority} onChange={(e) => onChange("priority", e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Category</span>
          <select value={filters.category} onChange={(e) => onChange("category", e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Due</span>
          <select value={filters.due} onChange={(e) => onChange("due", e.target.value)}>
            <option value="">Any time</option>
            {DUE_FILTERS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Sort by</span>
          <select value={filters.ordering} onChange={(e) => onChange("ordering", e.target.value)}>
            {ORDERINGS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hasFilters && (
        <button type="button" className="btn btn-ghost btn-sm filters-clear" onClick={onClear}>
          Clear filters
        </button>
      )}
    </section>
  );
}
