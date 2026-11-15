import { useState } from "react";
import { addSubtask, deleteSubtask, updateSubtask } from "../api/tasks";
import { useToast } from "../context/ToastContext";
import { parseApiError } from "../utils/errors";

let draftCounter = 0;

/**
 * Checklist of subtasks.
 *
 * - With a `taskId` (editing) every change is saved to the API immediately.
 * - Without one (creating) items are kept locally as drafts; the page saves them
 *   after the task itself has been created.
 */
export default function SubtaskChecklist({ taskId, items, onChange }) {
  const toast = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const completed = items.filter((item) => item.is_completed).length;
  const percent = items.length ? Math.round((completed / items.length) * 100) : 0;

  const run = async (action) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = (event) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    if (!taskId) {
      draftCounter += 1;
      onChange([...items, { id: `draft-${draftCounter}`, title, is_completed: false }]);
      setNewTitle("");
      return;
    }
    run(async () => {
      const created = await addSubtask(taskId, title);
      onChange([...items, created]);
      setNewTitle("");
    });
  };

  const handleToggle = (item) => {
    if (!taskId) {
      onChange(items.map((i) => (i.id === item.id ? { ...i, is_completed: !i.is_completed } : i)));
      return;
    }
    run(async () => {
      const updated = await updateSubtask(taskId, item.id, { is_completed: !item.is_completed });
      onChange(items.map((i) => (i.id === item.id ? updated : i)));
    });
  };

  const handleRemove = (item) => {
    if (!taskId) {
      onChange(items.filter((i) => i.id !== item.id));
      return;
    }
    run(async () => {
      await deleteSubtask(taskId, item.id);
      onChange(items.filter((i) => i.id !== item.id));
    });
  };

  return (
    <fieldset className="subtasks">
      <legend>
        Checklist {items.length > 0 && <span className="muted">({completed}/{items.length} done)</span>}
      </legend>

      {items.length > 0 && (
        <div className="subtask-progress" aria-hidden="true">
          <div style={{ width: `${percent}%` }} />
        </div>
      )}

      <ul className="subtask-list">
        {items.map((item) => (
          <li key={item.id} className={item.is_completed ? "done" : ""}>
            <label>
              <input
                type="checkbox"
                checked={item.is_completed}
                onChange={() => handleToggle(item)}
                disabled={busy}
              />
              <span>{item.title}</span>
            </label>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              aria-label={`Remove "${item.title}"`}
              onClick={() => handleRemove(item)}
              disabled={busy}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="subtask-add">
        <input
          type="text"
          value={newTitle}
          maxLength={200}
          placeholder="Add a checklist item…"
          aria-label="New checklist item"
          onChange={(event) => setNewTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAdd(event);
          }}
        />
        <button type="button" className="btn btn-outline btn-sm" onClick={handleAdd} disabled={busy || !newTitle.trim()}>
          Add
        </button>
      </div>
      {!taskId && items.length > 0 && <p className="field-hint">Checklist items are saved together with the task.</p>}
    </fieldset>
  );
}
