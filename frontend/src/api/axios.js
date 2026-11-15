import axios from "axios";
import { tokenStorage } from "./tokenStorage";

/**
 * The single Axios instance used by the whole app.
 *
 * - Base URL comes from VITE_API_URL (see frontend/.env.example).
 * - A request interceptor adds the JWT access token.
 * - A response interceptor refreshes an expired access token once, retries the
 *   failed request, and shares ONE in-flight refresh between concurrent requests.
 * - If refreshing fails the user is logged out via the registered handler.
 */
const baseURL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

let refreshPromise = null;
let authFailureHandler = () => {};

/** AuthContext registers a callback here to clear its state when refresh fails. */
export const setAuthFailureHandler = (handler) => {
  authFailureHandler = typeof handler === "function" ? handler : () => {};
};

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function refreshAccessToken() {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) {
    return Promise.reject(new Error("No refresh token available."));
  }
  return api
    .post("/auth/token/refresh/", { refresh }, { skipAuth: true, skipAuthRefresh: true })
    .then(({ data }) => {
      tokenStorage.setTokens({ access: data.access, refresh: data.refresh });
      return data.access;
    });
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    const canRetry =
      status === 401 &&
      original &&
      !original._retry &&
      !original.skipAuthRefresh &&
      Boolean(tokenStorage.getRefresh());

    if (!canRetry) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      // Concurrent 401s all wait for the same refresh request.
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newAccessToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(original);
    } catch (refreshError) {
      tokenStorage.clear();
      authFailureHandler();
      return Promise.reject(refreshError);
    }
  }
);

export default api;
