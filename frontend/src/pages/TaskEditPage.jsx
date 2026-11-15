import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getTask, updateTask } from "../api/tasks";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import TaskForm from "../components/TaskForm";
import { useToast } from "../context/ToastContext";
import useCategories from "../hooks/useCategories";
import { parseApiError } from "../utils/errors";
import { formatDateTime } from "../utils/format";

export default function TaskEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { categories, loading: categoriesLoading } = useCategories();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    getTask(id)
      .then((data) => {
        if (!cancelled) setTask(data);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.response?.status === 404) setNotFound(true);
        else toast.error(parseApiError(error, "Could not load the task.").message);
        setTask(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setServerErrors({});
    try {
      await updateTask(id, payload);
      toast.success("Task updated successfully.");
      navigate("/tasks");
    } catch (error) {
      const { message, fieldErrors } = parseApiError(error, "Could not save the task.");
      setServerErrors(fieldErrors);
      toast.error(message);
      setSubmitting(false);
    }
  };

  if (loading || categoriesLoading) return <Spinner label="Loading task…" />;

  if (notFound || !task) {
    return (
      <EmptyState
        icon="🔎"
        title={notFound ? "Task not found" : "Task unavailable"}
        message={
          notFound
            ? "This task does not exist or you do not have access to it."
            : "Something went wrong while loading this task."
        }
        action={
          <Link to="/tasks" className="btn btn-primary">
            Back to tasks
          </Link>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Edit task"
        subtitle={task.completed_at ? `Completed on ${formatDateTime(task.completed_at)}` : "Update the details below."}
      />
      <TaskForm task={task} categories={categories} onSubmit={handleSubmit} submitting={submitting} serverErrors={serverErrors} />
    </>
  );
}
