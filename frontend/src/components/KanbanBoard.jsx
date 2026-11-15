import { useState } from "react";
import { Link } from "react-router-dom";
import { CategoryPill, PriorityBadge } from "./Badges";
import { formatDate, STATUSES } from "../utils/format";

/**
 * Kanban board with HTML5 drag-and-drop between To Do / In Progress / Done.
 * A "Move to" select on every card provides the same action for touch devices
 * and keyboard users (native drag-and-drop does not work on most touch screens).
 */
export default function KanbanBoard({ tasks, onMove, movingId }) {
  const [draggedId, setDraggedId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);

  const handleDrop = (event, status) => {
    event.preventDefault();
    const id = Number(event.dataTransfer.getData("text/plain")) || draggedId;
    setOverColumn(null);
    setDraggedId(null);
    const task = tasks.find((t) => t.id === id);
    if (task && task.status !== status) onMove(task, status);
  };

  return (
    <div className="kanban">
      {STATUSES.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.value);
        return (
          <section
            key={column.value}
            className={`kanban-column kanban-${column.value}${overColumn === column.value ? " drag-over" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (overColumn !== column.value) setOverColumn(column.value);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setOverColumn(null);
            }}
            onDrop={(event) => handleDrop(event, column.value)}
            aria-label={`${column.label} column`}
          >
            <header className="kanban-header">
              <h2>{column.label}</h2>
              <span className="kanban-count">{columnTasks.length}</span>
            </header>

            <div className="kanban-cards">
              {columnTasks.length === 0 && <p className="kanban-empty">Drop tasks here</p>}
              {columnTasks.map((task) => (
                <article
                  key={task.id}
                  className={`kanban-card${draggedId === task.id ? " dragging" : ""}${task.is_overdue ? " is-overdue" : ""}${
                    movingId === task.id ? " is-moving" : ""
                  }`}
                  draggable={movingId !== task.id}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", String(task.id));
                    event.dataTransfer.effectAllowed = "move";
                    setDraggedId(task.id);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setOverColumn(null);
                  }}
                >
                  <Link to={`/tasks/${task.id}/edit`} className="kanban-title">
                    {task.title}
                  </Link>
                  <div className="kanban-meta">
                    <PriorityBadge priority={task.priority} />
                    <CategoryPill category={task.category_detail} />
                  </div>
                  <div className="kanban-meta muted">
                    {task.due_date && (
                      <span className={task.is_overdue ? "overdue" : ""}>📅 {formatDate(task.due_date)}</span>
                    )}
                    {task.subtask_count > 0 && (
                      <span>
                        ☑ {task.subtasks_completed}/{task.subtask_count}
                      </span>
                    )}
                    {task.recurrence !== "none" && <span title="Repeating task">🔁</span>}
                  </div>
                  <label className="kanban-move">
                    <span className="sr-only">Move "{task.title}" to</span>
                    <select
                      value={task.status}
                      disabled={movingId === task.id}
                      onChange={(event) => onMove(task, event.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          Move to: {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
