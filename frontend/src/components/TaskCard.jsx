import { Link } from "react-router-dom";
import { CategoryPill, PriorityBadge, StatusBadge } from "./Badges";
import { formatDate, labelFor, RECURRENCES } from "../utils/format";

export default function TaskCard({ task, onToggle, onDelete, busy = false }) {
  const done = task.status === "done";
  const overdue = task.is_overdue;

  return (
    <article className={`task-card${done ? " is-done" : ""}${overdue ? " is-overdue" : ""}`}>
      <div className="task-check">
        <input
          type="checkbox"
          checked={done}
          disabled={busy}
          onChange={() => onToggle(task)}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        />
      </div>

      <div className="task-main">
        <div className="task-title-row">
          <h3 className="task-title">{task.title}</h3>
          <div className="task-badges">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
        </div>

        {task.description && <p className="task-description">{task.description}</p>}

        <div className="task-meta">
          <CategoryPill category={task.category_detail} />
          {task.due_date && (
            <span className={`task-due${overdue ? " overdue" : ""}`}>
              📅 {formatDate(task.due_date)}
              {overdue && <strong> · Overdue</strong>}
            </span>
          )}
          {task.recurrence !== "none" && (
            <span className="task-recurrence" title="Repeating task">
              🔁 {labelFor(RECURRENCES, task.recurrence)}
            </span>
          )}
          {task.subtask_count > 0 && (
            <span className="task-subtasks" title="Checklist progress">
              ☑ {task.subtasks_completed}/{task.subtask_count}
            </span>
          )}
        </div>
      </div>

      <div className="task-actions">
        <Link to={`/tasks/${task.id}/edit`} className="btn btn-outline btn-sm">
          Edit
        </Link>
        <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => onDelete(task)} disabled={busy}>
          Delete
        </button>
      </div>
    </article>
  );
}
