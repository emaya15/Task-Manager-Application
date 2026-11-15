import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { deleteTask, getTasks, toggleTaskComplete } from "../api/tasks";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import TaskCard from "../components/TaskCard";
import TaskFilters from "../components/TaskFilters";
import { useToast } from "../context/ToastContext";
import useCategories from "../hooks/useCategories";
import useDebounce from "../hooks/useDebounce";
import { parseApiError } from "../utils/errors";
import { PAGE_SIZE } from "../utils/format";

const FILTER_KEYS = ["search", "status", "priority", "category", "due", "ordering"];

/**
 * Task list. All filters, the sort order and the page number live in the URL
 * query string (?status=todo&page=2), so a browser refresh, a bookmark or the
 * back button restores exactly the same view.
 */
export default function TasksPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories } = useCategories();

  const filters = {
    search: searchParams.get("search") ?? "",
    status: searchParams.get("status") ?? "",
    priority: searchParams.get("priority") ?? "",
    category: searchParams.get("category") ?? "",
    due: searchParams.get("due") ?? "",
    ordering: searchParams.get("ordering") ?? "",
  };
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const queryString = searchParams.toString();

  const [result, setResult] = useState({ count: 0, next: null, previous: null, results: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const requestId = useRef(0);

  // --- URL helpers ----------------------------------------------------------
  const updateParams = useCallback(
    (changes, { resetPage = true, replace = false } = {}) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          Object.entries(changes).forEach(([key, value]) => {
            if (value === "" || value === null || value === undefined) next.delete(key);
            else next.set(key, String(value));
          });
          if (resetPage) next.delete("page");
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  // --- Search with a 500 ms debounce ---------------------------------------
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 500);
  // The last search value this page wrote to the URL. A URL value different from it
  // means the URL was changed from outside (navbar link, back button, "clear filters").
  const lastPushedSearch = useRef(filters.search);

  useEffect(() => {
    const next = debouncedSearch.trim();
    if (next !== filters.search) {
      lastPushedSearch.current = next;
      updateParams({ search: next }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    if (filters.search !== lastPushedSearch.current) {
      lastPushedSearch.current = filters.search;
      setSearchInput(filters.search);
    }
  }, [filters.search]);

  // --- Data loading ----------------------------------------------------------
  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    const params = {};
    new URLSearchParams(queryString).forEach((value, key) => {
      if ([...FILTER_KEYS, "page"].includes(key) && value) params[key] = value;
    });
    try {
      const data = await getTasks(params);
      if (current === requestId.current) setResult(data);
    } catch (error) {
      if (current !== requestId.current) return;
      if (error.response?.status === 404 && params.page && params.page !== "1") {
        // The page no longer exists (e.g. the last task on it was deleted): go back to page 1.
        updateParams({ page: "" }, { resetPage: true, replace: true });
        return;
      }
      toast.error(parseApiError(error, "Could not load tasks.").message);
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [queryString, toast, updateParams]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Actions -------------------------------------------------------------
  const handleToggle = async (task) => {
    setBusyId(task.id);
    try {
      const updated = await toggleTaskComplete(task.id);
      toast.success(updated.status === "done" ? "Task completed." : "Task reopened.");
      await load(); // refetch: filters, ordering and recurring tasks may change the list
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteTask(toDelete.id);
      toast.success("Task deleted.");
      setToDelete(null);
      await load();
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setDeleting(false);
    }
  };

  const hasFilters = FILTER_KEYS.some((key) => filters[key]);
  const clearFilters = () => {
    setSearchInput("");
    setSearchParams({});
  };

  const newTaskButton = (
    <Link to="/tasks/new" className="btn btn-primary">
      + New task
    </Link>
  );

  return (
    <>
      <PageHeader title="Tasks" subtitle="Search, filter and manage everything on your plate." actions={newTaskButton} />

      <TaskFilters
        filters={filters}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        categories={categories}
        onChange={(name, value) => updateParams({ [name]: value })}
        onClear={clearFilters}
        hasFilters={hasFilters}
      />

      {loading && result.results.length === 0 ? (
        <Spinner label="Loading tasks…" />
      ) : result.results.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon="🔍"
            title="No tasks match your filters"
            message="Try a different search or clear the filters."
            action={
              <button type="button" className="btn btn-outline" onClick={clearFilters}>
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            icon="🌱"
            title="Nothing to do yet"
            message="Add your first task to get started."
            action={newTaskButton}
          />
        )
      ) : (
        <div className={`task-list${loading ? " is-loading" : ""}`} aria-busy={loading}>
          {result.results.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              busy={busyId === task.id}
              onToggle={handleToggle}
              onDelete={setToDelete}
            />
          ))}
          <Pagination
            page={page}
            count={result.count}
            pageSize={PAGE_SIZE}
            hasNext={Boolean(result.next)}
            hasPrevious={Boolean(result.previous)}
            disabled={loading}
            onChange={(nextPage) => updateParams({ page: nextPage > 1 ? nextPage : "" }, { resetPage: false })}
          />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this task?"
        message={toDelete ? `"${toDelete.title}" will be permanently deleted. This cannot be undone.` : ""}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
