import api from "./axios";

/** Paginated list. `params` may contain search, status, priority, category, due, ordering, page, page_size. */
export const getTasks = (params = {}) => api.get("/tasks/", { params }).then((r) => r.data);

/** Loads every page (used by the Kanban board). */
export async function getAllTasks(params = {}) {
  const all = [];
  let page = 1;
  // page_size is capped at 100 by the server
  for (;;) {
    const data = await getTasks({ ...params, page_size: 100, page });
    all.push(...data.results);
    if (!data.next) break;
    page += 1;
  }
  return all;
}

export const getTask = (id) => api.get(`/tasks/${id}/`).then((r) => r.data);

export const createTask = (payload) => api.post("/tasks/", payload).then((r) => r.data);

export const updateTask = (id, payload) => api.put(`/tasks/${id}/`, payload).then((r) => r.data);

export const patchTask = (id, payload) => api.patch(`/tasks/${id}/`, payload).then((r) => r.data);

export const deleteTask = (id) => api.delete(`/tasks/${id}/`);

export const toggleTaskComplete = (id) => api.patch(`/tasks/${id}/toggle-complete/`).then((r) => r.data);

export const getDashboard = () => api.get("/tasks/dashboard/").then((r) => r.data);

// --- Subtasks (checklist items) ---
export const addSubtask = (taskId, title) =>
  api.post(`/tasks/${taskId}/subtasks/`, { title }).then((r) => r.data);

export const updateSubtask = (taskId, subtaskId, payload) =>
  api.patch(`/tasks/${taskId}/subtasks/${subtaskId}/`, payload).then((r) => r.data);

export const deleteSubtask = (taskId, subtaskId) => api.delete(`/tasks/${taskId}/subtasks/${subtaskId}/`);
