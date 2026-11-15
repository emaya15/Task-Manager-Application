/**
 * Token storage.
 *
 * - The short-lived ACCESS token (30 min) is kept in memory only, so it is never
 *   written to disk and disappears when the tab closes.
 * - The REFRESH token (1 day) lives in localStorage so the session survives a
 *   page refresh. On reload the app exchanges it for a new access token.
 *
 * Note: any JavaScript-readable storage is exposed to XSS. The refresh token is
 * rotated and blacklisted on logout to limit the damage of a leaked token.
 */
const REFRESH_KEY = "tm_refresh_token";

let accessToken = null;

export const tokenStorage = {
  getAccess: () => accessToken,
  setAccess: (token) => {
    accessToken = token || null;
  },
  getRefresh: () => {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  setRefresh: (token) => {
    try {
      if (token) localStorage.setItem(REFRESH_KEY, token);
      else localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* storage unavailable (private mode) - session just will not persist */
    }
  },
  setTokens: ({ access, refresh }) => {
    if (access !== undefined) tokenStorage.setAccess(access);
    if (refresh !== undefined) tokenStorage.setRefresh(refresh);
  },
  clear: () => {
    accessToken = null;
    tokenStorage.setRefresh(null);
  },
};
