export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

export const RECURRENCES = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

export const DUE_FILTERS = [
  { value: "today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Upcoming" },
];

export const ORDERINGS = [
  { value: "", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "due_date", label: "Due date (soonest)" },
  { value: "-due_date", label: "Due date (latest)" },
  { value: "-priority", label: "Priority (high to low)" },
  { value: "priority", label: "Priority (low to high)" },
];

export const labelFor = (list, value) => list.find((item) => item.value === value)?.label ?? value;

/** Local YYYY-MM-DD (not UTC) so "today" matches what the user sees. */
export function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Formats a YYYY-MM-DD string without timezone shifting. */
export function formatDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(isoDateTime) {
  if (!isoDateTime) return "";
  return new Date(isoDateTime).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const PAGE_SIZE = 10;
