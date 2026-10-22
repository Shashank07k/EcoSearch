import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as authService from '../services/authService.js';
import {
  getToken,
  getStoredUser,
  setSession,
  setStoredUser,
  clearSession,
  subscribeToToken,
} from '../services/tokenStore.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setAuthToken] = useState(() => getToken());
  // Restore the cached public profile so a signed-in user is rendered instantly
  // on reload/navigation. Without this, `user` starts null and `isAuthenticated`
  // is false until /api/auth/me resolves, which briefly shows anonymous copy
  // ("Sign in to analyze") even for a logged-in user.
  const [user, setUser] = useState(() => getStoredUser());
  // 'loading' is only true when we still need to resolve WHO the user is
  // (token present but no cached profile). A cached session renders immediately
  // and re-validates in the background.
  const [loading, setLoading] = useState(
    () => Boolean(getToken()) && !getStoredUser(),
  );
  // Incremented whenever a session starts (login/register) or ends (logout).
  // A bootstrap request captures the generation before awaiting; if it changed
  // while the request was in flight, the result is stale and is discarded —
  // so a slow/old /api/auth/me can never overwrite a newer successful login.
  const generationRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const startedGeneration = generationRef.current;

    async function bootstrap() {
      const stored = getToken();
      if (!stored) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        // Never let a hung request keep the whole app in its loading state:
        // the public home page must render even if the backend is unavailable.
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await authService.fetchCurrentUser({ signal: controller.signal });
        clearTimeout(timeout);
        if (cancelled || generationRef.current !== startedGeneration) return;
        setUser(response.data.user);
        // Keep the cached profile fresh (silent: no token change to broadcast).
        setStoredUser(response.data.user);
      } catch (error) {
        if (cancelled || generationRef.current !== startedGeneration) return;
        // Only a genuine authentication failure (401 = expired/invalid token)
        // invalidates the session. Network errors, gateways (502/504), server
        // errors (500) and "service unavailable" (503, e.g. backend restarting)
        // must NOT log the user out: the cached session survives and the public
        // app keeps working.
        if (error?.status === 401) {
          clearSession();
          setAuthToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();

    // React to logout (or a 401 clearing the token) in this tab/component.
    const unsubscribe = subscribeToToken(() => {
      const next = getToken();
      setAuthToken(next);
      if (!next) setUser(null);
    });
    return () => { cancelled = true; unsubscribe(); controller.abort(); };
  }, []);

  async function persistAuth(response) {
    const nextToken = response?.data?.token;
    const nextUser = response?.data?.user;
    if (!nextToken || !nextUser) {
      throw new Error('Received an incomplete authentication response.');
    }
    // Invalidate any bootstrap request still in flight.
    generationRef.current += 1;
    setSession(nextToken, nextUser);
    setAuthToken(nextToken);
    setUser(nextUser);
    setLoading(false);
    return nextUser;
  }

  const login = (payload) => authService.login(payload).then(persistAuth);
  const register = (payload) => authService.register(payload).then(persistAuth);

  function logout() {
    // JWTs are stateless: client-side removal is the logout mechanism in this
    // phase (no server-side revocation/refresh tokens yet).
    generationRef.current += 1;
    clearSession();
    setAuthToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(token && user),
    loading,
    login,
    register,
    logout,
    hasRole: (role) => user?.role === role,
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
