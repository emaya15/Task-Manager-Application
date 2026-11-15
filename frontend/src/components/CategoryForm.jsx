import { useEffect, useState } from "react";
import FormField from "./FormField";

const DEFAULT_COLOR = "#3b82f6";

/** Add / edit form for a category, including a colour picker. */
export default function CategoryForm({ category = null, onSubmit, onCancel, submitting, serverErrors = {} }) {
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? DEFAULT_COLOR);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(category?.name ?? "");
    setColor(category?.color ?? DEFAULT_COLOR);
    setError("");
  }, [category]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    if (trimmed.length > 50) {
      setError("Name cannot exceed 50 characters.");
      return;
    }
    setError("");
    onSubmit({ name: trimmed, color });
  };

  const isEdit = Boolean(category);

  return (
    <form className="category-form" onSubmit={handleSubmit} noValidate>
      <FormField id="category-name" label="Name" error={error || serverErrors.name}>
        <input
          id="category-name"
          type="text"
          value={name}
          maxLength={60}
          placeholder="e.g. Work"
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
        />
      </FormField>

      <FormField id="category-color" label="Colour" error={serverErrors.color}>
        <div className="color-picker">
          <input
            id="category-color"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            aria-label="Pick a colour"
          />
          <code>{color}</code>
        </div>
      </FormField>

      <div className="form-actions">
        {isEdit && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save category" : "Add category"}
        </button>
      </div>
    </form>
  );
}
