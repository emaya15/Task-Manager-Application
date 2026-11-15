import api from "./axios";

export const registerUser = (payload) => api.post("/auth/register/", payload, { skipAuth: true }).then((r) => r.data);

export const loginUser = (payload) =>
  api.post("/auth/login/", payload, { skipAuth: true, skipAuthRefresh: true }).then((r) => r.data);

export const logoutUser = (refresh) =>
  api.post("/auth/logout/", { refresh }, { skipAuth: true, skipAuthRefresh: true }).then((r) => r.data);

export const getMe = () => api.get("/auth/me/").then((r) => r.data);

export const updateMe = (payload) => api.put("/auth/me/", payload).then((r) => r.data);

export const changePassword = (payload) => api.put("/auth/change-password/", payload).then((r) => r.data);
