import { useState } from "react";
import { createCategory, deleteCategory, updateCategory } from "../api/categories";
import CategoryForm from "../components/CategoryForm";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import { useToast } from "../context/ToastContext";
import useCategories from "../hooks/useCategories";
import { parseApiError } from "../utils/errors";

export default function CategoriesPage() {
  const toast = useToast();
  const { categories, loading, error, reload } = useCategories();

  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async (values) => {
    setSubmitting(true);
    setServerErrors({});
    try {
      if (editing) {
        await updateCategory(editing.id, values);
        toast.success("Category updated.");
        setEditing(null);
      } else {
        await createCategory(values);
        toast.success("Category added.");
      }
      await reload();
    } catch (err) {
      const { message, fieldErrors } = parseApiError(err, "Could not save the category.");
      setServerErrors(fieldErrors);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteCategory(toDelete.id);
      toast.success("Category deleted. Its tasks were kept.");
      if (editing?.id === toDelete.id) setEditing(null);
      setToDelete(null);
      await reload();
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  const startEditing = (category) => {
    setServerErrors({});
    setEditing(category);
  };

  return (
    <>
      <PageHeader title="Categories" subtitle="Group your tasks with colour-coded labels." />

      <div className="categories-layout">
        <section className="card">
          <h2>{editing ? `Edit “${editing.name}”` : "Add a category"}</h2>
          <CategoryForm
            category={editing}
            onSubmit={handleSave}
            onCancel={() => {
              setEditing(null);
              setServerErrors({});
            }}
            submitting={submitting}
            serverErrors={serverErrors}
          />
        </section>

        <section className="card">
          <h2>Your categories</h2>
          {loading ? (
            <Spinner label="Loading categories…" />
          ) : error ? (
            <EmptyState
              icon="⚠️"
              title="Could not load categories"
              action={
                <button type="button" className="btn btn-primary" onClick={reload}>
                  Try again
                </button>
              }
            />
          ) : categories.length === 0 ? (
            <EmptyState icon="🏷️" title="No categories yet" message="Add your first category using the form." />
          ) : (
            <ul className="category-list">
              {categories.map((category) => (
                <li key={category.id} className={editing?.id === category.id ? "is-editing" : ""}>
                  <span className="color-swatch" style={{ background: category.color }} aria-hidden="true" />
                  <div className="category-info">
                    <strong>{category.name}</strong>
                    <span className="muted">
                      {category.task_count} task{category.task_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="category-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => startEditing(category)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setToDelete(category)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this category?"
        message={
          toDelete
            ? `"${toDelete.name}" will be removed. Its ${toDelete.task_count} task(s) will not be deleted; they will simply have no category.`
            : ""
        }
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
