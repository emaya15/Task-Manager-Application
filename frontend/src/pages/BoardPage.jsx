import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAllTasks, patchTask } from "../api/tasks";
import EmptyState from "../components/EmptyState";
import KanbanBoard from "../components/KanbanBoard";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import { useToast } from "../context/ToastContext";
import { parseApiError } from "../utils/errors";
import { labelFor, STATUSES } from "../utils/format";

/** Kanban view: drag cards between To Do, In Progress and Done. */
export default function BoardPage() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [movingId, setMovingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setTasks(await getAllTasks());
      setFailed(false);
    } catch (error) {
      setFailed(true);
      toast.error(parseApiError(error, "Could not load the board.").message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMove = async (task, status) => {
    if (task.status === status) return;
    const previous = tasks;
    // Optimistic update so the card jumps immediately; rolled back on failure.
    setTasks((current) => current.map((t) => (t.id === task.id ? { ...t, status } : t)));
    setMovingId(task.id);
    try {
      const updated = await patchTask(task.id, { status });
      setTasks((current) => current.map((t) => (t.id === task.id ? updated : t)));
      toast.success(`Moved to ${labelFor(STATUSES, status)}.`);
      // Completing a repeating task creates its next occurrence - reload to show it.
      if (status === "done" && task.recurrence !== "none") await load();
    } catch (error) {
      setTasks(previous);
      toast.error(parseApiError(error, "Could not move the task.").message);
    } finally {
      setMovingId(null);
    }
  };

  const newTaskButton = (
    <Link to="/tasks/new" className="btn btn-primary">
      + New task
    </Link>
  );

  return (
    <>
      <PageHeader title="Board" subtitle="Drag cards between columns to update their status." actions={newTaskButton} />
      {loading ? (
        <Spinner label="Loading board…" />
      ) : failed ? (
        <EmptyState
          icon="⚠️"
          title="Board unavailable"
          action={
            <button type="button" className="btn btn-primary" onClick={() => { setLoading(true); load(); }}>
              Try again
            </button>
          }
        />
      ) : tasks.length === 0 ? (
        <EmptyState icon="🗂️" title="Your board is empty" message="Create a task to see it here." action={newTaskButton} />
      ) : (
        <KanbanBoard tasks={tasks} onMove={handleMove} movingId={movingId} />
      )}
    </>
  );
}
