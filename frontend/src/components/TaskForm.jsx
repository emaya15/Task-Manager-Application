import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FormField from "./FormField";
import SubtaskChecklist from "./SubtaskChecklist";
import { PRIORITIES, RECURRENCES, STATUSES, todayISO } from "../utils/format";

const EMPTY = {
  title: "",
  description: "",
  category: "",
  priority: "medium",
  status: "todo",
  due_date: "",
  recurrence: "none",
};

function toFormValues(task) {
  if (!task) return EMPTY;
  return {
    title: task.title ?? "",
    description: task.description ?? "",
    category: task.category ? String(task.category) : "",
    priority: task.priority ?? "medium",
    status: task.status ?? "todo",
    due_date: task.due_date ?? "",
    recurrence: task.recurrence ?? "none",
  };
}

/**
 * Reusable form for creating and editing tasks.
 *
 * Props:
 *  - task: existing task (edit mode) or null (create mode)
 *  - categories: list of the user's categories
 *  - onSubmit(payload, draftSubtasks): called with API-ready values
 *  - submitting: disables the submit button while a request is in flight
 *  - serverErrors: field errors returned by the API
 */
export default function TaskForm({ task = null, categories, onSubmit, submitting, serverErrors = {} }) {
  const isEdit = Boolean(task);
  const [values, setValues] = useState(() => toFormValues(task));
  const [errors, setErrors] = useState({});
  const [subtasks, setSubtasks] = useState(() => task?.subtasks ?? []);

  // Populate the form when the task being edited finishes loading / changes.
  useEffect(() => {
    setValues(toFormValues(task));
    setSubtasks(task?.subtasks ?? []);
    setErrors({});
  }, [task]);

  const setField = (name) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const validate = () => {
    const found = {};
    const title = values.title.trim();
    if (title.length < 3) found.title = "Title must be at least 3 characters.";
    else if (title.length > 100) found.title = "Title cannot exceed 100 characters.";
    if (values.description.length > 2000) found.description = "Description cannot exceed 2000 characters.";
    // Past dates are rejected only when creating (existing overdue tasks stay editable).
    if (!isEdit && values.due_date && values.due_date < todayISO()) {
      found.due_date = "Due date cannot be in the past.";
    }
    if (values.recurrence !== "none" && !values.due_date) {
      found.due_date = "A due date is required for recurring tasks.";
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting || !validate()) return;
    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      category: values.category ? Number(values.category) : null,
      priority: values.priority,
      status: values.status,
      due_date: values.due_date || null,
      recurrence: values.recurrence,
    };
    onSubmit(payload, isEdit ? [] : subtasks);
  };

  const errorFor = (name) => errors[name] || serverErrors[name];

  return (
    <form className="card form-card" onSubmit={handleSubmit} noValidate>
      <FormField id="task-title" label="Title *" error={errorFor("title")}>
        <input
          id="task-title"
          type="text"
          value={values.title}
          onChange={setField("title")}
          maxLength={120}
          placeholder="e.g. Prepare quarterly report"
          autoFocus={!isEdit}
        />
      </FormField>

      <FormField id="task-description" label="Description" error={errorFor("description")}>
        <textarea
          id="task-description"
          rows={4}
          value={values.description}
          onChange={setField("description")}
          placeholder="Add some details (optional)"
        />
      </FormField>

      <div className="form-grid">
        <FormField id="task-category" label="Category" error={errorFor("category")}>
          <select id="task-category" value={values.category} onChange={setField("category")}>
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="task-due" label="Due date" error={errorFor("due_date")}>
          <input
            id="task-due"
            type="date"
            value={values.due_date}
            min={isEdit ? undefined : todayISO()}
            onChange={setField("due_date")}
          />
        </FormField>

        <FormField id="task-priority" label="Priority" error={errorFor("priority")}>
          <select id="task-priority" value={values.priority} onChange={setField("priority")}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="task-status" label="Status" error={errorFor("status")}>
          <select id="task-status" value={values.status} onChange={setField("status")}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id="task-recurrence"
          label="Repeat"
          error={errorFor("recurrence")}
          hint="When a repeating task is completed, the next one is created automatically."
        >
          <select id="task-recurrence" value={values.recurrence} onChange={setField("recurrence")}>
            {RECURRENCES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {categories.length === 0 && (
        <p className="field-hint">
          You have no categories yet. <Link to="/categories">Create one</Link> to organise your tasks.
        </p>
      )}

      <SubtaskChecklist taskId={isEdit ? task.id : null} items={subtasks} onChange={setSubtasks} />

      <div className="form-actions">
        <Link to="/tasks" className="btn btn-ghost">
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Create task"}
        </button>
      </div>
    </form>
  );
}
