import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => tokenStore.get());
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  const signIn = useCallback(({ token: t, user: u }) => {
    tokenStore.set(t);
    setToken(t);
    setUser(u);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api('/api/auth/me')
      .then(({ user: u }) => !cancelled && setUser(u))
      // Only a rejected token signs you out; network errors or rate limits keep the session.
      .catch((err) => !cancelled && err.status === 401 && logout())
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const value = useMemo(
    () => ({ user, token, loading, signIn, logout, isStaff: user?.role === 'admin' || user?.role === 'reviewer', isAdmin: user?.role === 'admin' }),
    [user, token, loading, signIn, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
