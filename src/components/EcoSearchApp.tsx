'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import App from '../../frontend/src/App.jsx';
import LoadingShell from './LoadingShell';

/**
 * Hosting-preview adapter.
 *
 * The independent React app relies on `window.location.hash` and
 * `localStorage`, so it must only render in the browser. We use an explicit
 * `mounted` guard instead of `next/dynamic({ ssr: false })` because a dynamic
 * import can stay pending indefinitely (slow LAN, blocked chunk, proxy hiccup),
 * which left the preview permanently stuck on "Loading EcoSearch…" with no
 * way to recover. A plain import is bundled synchronously and cannot hang.
 *
 * The watchdog below also guarantees the preview never sits on a loading state
 * forever: if mounting has not finished after a few seconds we surface a
 * retryable message. The Vite deployment (frontend/) does not use this adapter.
 *
 * The public home page must render even when the backend/API is unavailable:
 * AuthProvider settles into an unauthenticated state on its own, so no backend
 * call blocks this mount.
 */
export default function EcoSearchApp() {
  const [mounted, setMounted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Configure the public API base for the shared frontend apiClient.
    // Secrets never enter this bundle; only the public backend address does.
    (globalThis as { __ECOSEARCH_API_BASE_URL__?: string }).__ECOSEARCH_API_BASE_URL__ =
      process.env.NEXT_PUBLIC_ECOSEARCH_API_BASE_URL || '/api';
    setMounted(true);
  }, []);

  // Watchdog: if the app still has not mounted, stop waiting silently.
  useEffect(() => {
    if (mounted) return;
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [mounted]);

  if (!mounted) {
    if (!timedOut) {
      // First paint is a static, faithful app shell (not a bare "Loading…"
      // spinner) so users see the real EcoSearch UI immediately while the JS
      // bundle downloads. The static shell renders identically on the server
      // and the client's pre-mount render, so hydration stays clean. The
      // real app swaps in the moment it mounts (mounted -> true).
      return <LoadingShell />;
    }
    return (
      <div style={loadingStyle}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ margin: '0 0 12px' }}>EcoSearch could not finish loading.</p>
          <button
            type="button"
            onClick={() => globalThis.location.reload()}
            style={retryStyle}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <PreviewErrorBoundary>
      <App />
    </PreviewErrorBoundary>
  );
}

const loadingStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: '#f8faf7',
  color: '#547355',
  fontFamily: 'system-ui',
};

const retryStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 8,
  border: '1px solid #cbd9c2',
  background: '#fff',
  color: '#3f5c40',
  cursor: 'pointer',
};

/** Keeps a render failure inside the preview from producing a blank page. */
class PreviewErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[preview] EcoSearch failed to render:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={loadingStyle}>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <p style={{ margin: '0 0 12px' }}>EcoSearch could not be displayed.</p>
            <button
              type="button"
              onClick={() => globalThis.location.reload()}
              style={retryStyle}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
