import { useEffect } from 'react';
import Icon from './Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { navigate, parseRoute } from '../hooks/useHashRoute.js';

/**
 * Client-side guard for authenticated pages. It does not replace the backend
 * middleware — every protected API call still requires a valid JWT.
 */
export default function ProtectedRoute({ route, children }) {
  const { isAuthenticated, loading } = useAuth();
  const next = encodeURIComponent(`#${parseRoute(route).pathname}`);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate(`/login?next=${next}`);
  }, [loading, isAuthenticated, next]);

  if (loading || !isAuthenticated) {
    return (
      <div className="auth-page" role="status" aria-live="polite">
        <span className="spinner" /> Redirecting to login…
      </div>
    );
  }
  return children;
}
