import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addSubtask, createTask, updateSubtask } from "../api/tasks";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import TaskForm from "../components/TaskForm";
import { useToast } from "../context/ToastContext";
import useCategories from "../hooks/useCategories";
import { parseApiError } from "../utils/errors";

export default function TaskCreatePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { categories, loading } = useCategories();
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState({});

  const handleSubmit = async (payload, draftSubtasks) => {
    setSubmitting(true);
    setServerErrors({});
    let created;
    try {
      created = await createTask(payload);
    } catch (error) {
      const { message, fieldErrors } = parseApiError(error, "Could not create the task.");
      setServerErrors(fieldErrors);
      toast.error(message);
      setSubmitting(false);
      return;
    }

    // Save the checklist drafts now that the task has an id.
    let failedSubtasks = 0;
    for (const draft of draftSubtasks) {
      try {
        const saved = await addSubtask(created.id, draft.title);
        if (draft.is_completed) {
          // The API creates subtasks unchecked, so tick the ones the user already checked.
          await updateSubtask(created.id, saved.id, { is_completed: true });
        }
      } catch {
        failedSubtasks += 1;
      }
    }

    if (failedSubtasks) {
      toast.error(`Task created, but ${failedSubtasks} checklist item(s) could not be saved.`);
      navigate(`/tasks/${created.id}/edit`, { replace: true });
    } else {
      toast.success("Task created successfully.");
      navigate("/tasks");
    }
  };

  return (
    <>
      <PageHeader title="New task" subtitle="Describe what needs to be done." />
      {loading ? (
        <Spinner label="Loading…" />
      ) : (
        <TaskForm categories={categories} onSubmit={handleSubmit} submitting={submitting} serverErrors={serverErrors} />
      )}
    </>
  );
}
