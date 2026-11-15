import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard } from "../api/tasks";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import ProgressBar from "../components/ProgressBar";
import Spinner from "../components/Spinner";
import StatCard from "../components/StatCard";
import { PriorityBadge } from "../components/Badges";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { parseApiError } from "../utils/errors";
import { formatDate } from "../utils/format";

function MiniTaskList({ tasks, emptyText, showDue = false }) {
  if (tasks.length === 0) return <p className="muted mini-empty">{emptyText}</p>;
  return (
    <ul className="mini-list">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link to={`/tasks/${task.id}/edit`} className="mini-title">
            {task.title}
          </Link>
          <span className="mini-meta">
            {showDue && task.due_date && <span className="overdue">{formatDate(task.due_date)}</span>}
            <PriorityBadge priority={task.priority} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setData(await getDashboard());
    } catch (error) {
      setFailed(true);
      toast.error(parseApiError(error, "Could not load the dashboard.").message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const addButton = (
    <Link to="/tasks/new" className="btn btn-primary">
      + New task
    </Link>
  );

  if (loading) return <Spinner label="Loading dashboard…" />;

  if (failed || !data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState
          icon="⚠️"
          title="Dashboard unavailable"
          message="We could not load your statistics."
          action={
            <button type="button" className="btn btn-primary" onClick={load}>
              Try again
            </button>
          }
        />
      </>
    );
  }

  const maxCategoryCount = Math.max(1, ...data.category_stats.map((c) => c.count));

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.first_name || "there"} 👋`}
        subtitle="Here is where your tasks stand today."
        actions={addButton}
      />

      {data.total === 0 ? (
        <EmptyState
          icon="🚀"
          title="No tasks yet"
          message="Create your first task and your statistics will show up here."
          action={addButton}
        />
      ) : (
        <>
          <section className="stats-grid" aria-label="Task statistics">
            <StatCard label="Total tasks" value={data.total} icon="📋" to="/tasks" />
            <StatCard label="To Do" value={data.todo} icon="🕒" tone="todo" to="/tasks?status=todo" />
            <StatCard label="In Progress" value={data.in_progress} icon="⚙️" tone="progress" to="/tasks?status=in_progress" />
            <StatCard label="Done" value={data.done} icon="✅" tone="done" to="/tasks?status=done" />
            <StatCard label="Overdue" value={data.overdue} icon="⏰" tone="danger" to="/tasks?due=overdue" />
            <StatCard label="Due today" value={data.due_today} icon="📅" tone="warning" to="/tasks?due=today" />
          </section>

          <section className="card completion-card">
            <div className="completion-header">
              <h2>Completion</h2>
              <strong>{data.completion_percentage}%</strong>
            </div>
            <ProgressBar value={data.completion_percentage} label="Completion percentage" />
            <p className="muted">
              {data.done} of {data.total} tasks completed
            </p>
          </section>

          <div className="dashboard-columns">
            <section className="card">
              <h2>Due today</h2>
              <MiniTaskList tasks={data.due_today_tasks} emptyText="Nothing due today. 🎉" />
            </section>
            <section className="card">
              <h2>Overdue</h2>
              <MiniTaskList tasks={data.overdue_tasks} emptyText="No overdue tasks. Nice work!" showDue />
            </section>
          </div>

          <section className="card">
            <h2>Tasks by category</h2>
            {data.category_stats.length === 0 ? (
              <p className="muted">Create categories to see a breakdown.</p>
            ) : (
              <ul className="category-stats">
                {data.category_stats.map((row) => (
                  <li key={row.id ?? "uncategorized"}>
                    <div className="category-stats-head">
                      <span className="category-pill">
                        <span className="color-dot" style={{ background: row.color }} aria-hidden="true" />
                        {row.name}
                      </span>
                      <span className="muted">
                        {row.completed}/{row.count} done
                      </span>
                    </div>
                    <div className="bar-track" aria-hidden="true">
                      <div className="bar-fill" style={{ width: `${(row.count / maxCategoryCount) * 100}%`, background: row.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
