import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setAuthFailureHandler } from "../api/axios";
import { getMe, loginUser, logoutUser, registerUser, updateMe } from "../api/auth";
import { tokenStorage } from "../api/tokenStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // true while we check whether a stored session is still valid on first load
  const [initializing, setInitializing] = useState(() => Boolean(tokenStorage.getRefresh()));

  // If the axios layer cannot refresh the token any more, drop the session.
  useEffect(() => {
    setAuthFailureHandler(() => setUser(null));
    return () => setAuthFailureHandler(null);
  }, []);

  // Restore the session after a browser refresh: /auth/me/ triggers a token refresh
  // automatically (via the interceptor) because there is no access token in memory yet.
  useEffect(() => {
    if (!tokenStorage.getRefresh()) return undefined;
    let cancelled = false;
    getMe()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        tokenStorage.clear();
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginUser({ email, password });
    tokenStorage.setTokens({ access: data.access, refresh: data.refresh });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback((payload) => registerUser(payload), []);

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefresh();
    try {
      if (refresh) await logoutUser(refresh); // blacklists the refresh token server-side
    } catch {
      /* even if the server call fails we still clear local credentials */
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

  const saveProfile = useCallback(async (payload) => {
    const updated = await updateMe(payload);
    setUser(updated);
    return updated;
  }, []);

  const value = useMemo(
    () => ({ user, initializing, isAuthenticated: Boolean(user), login, register, logout, saveProfile }),
    [user, initializing, login, register, logout, saveProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
