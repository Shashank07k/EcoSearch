// Simplified token persistence for this student project: localStorage lets a
// SPA persist the JWT across reloads. Trade-off: any XSS on the same origin can
// read it, and it cannot be HttpOnly. Mitigations here: text-only React
// rendering, no dangerouslySetInnerHTML, short-lived tokens (JWT_EXPIRES_IN),
// no refresh tokens, and logout simply removes the token. A production app
// should prefer HttpOnly+Secure+SameSite cookies and CSRF protections.
const KEY = 'ecosearch_token';
// The cached profile is the API's *public* user shape (no password hash, no
// secrets). Storing it lets the UI render the signed-in shell instantly on
// reload while the token is re-validated against /api/auth/me in the background
// (avoids a "Sign in to analyze" flash on protected-looking actions).
const USER_KEY = 'ecosearch_user';
const listeners = new Set();

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((listener) => {
    try { listener(); } catch { /* a subscriber must never break storage updates */ }
  });
}

export function getToken() {
  return storage()?.getItem(KEY) || null;
}

export function setToken(token) {
  storage()?.setItem(KEY, token);
  emit();
}

export function clearToken() {
  storage()?.removeItem(KEY);
  storage()?.removeItem(USER_KEY);
  emit();
}

/** Returns the cached public user object, or null when absent/corrupt. */
export function getStoredUser() {
  try {
    const raw = storage()?.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.email !== 'string') return null;
    if (typeof parsed.id !== 'string') return null;
    return parsed;
  } catch {
    // Corrupt entry: drop it so a bad value can never wedge the app.
    try { storage()?.removeItem(USER_KEY); } catch { /* ignore */ }
    return null;
  }
}

export function setStoredUser(user) {
  try {
    if (!user) { storage()?.removeItem(USER_KEY); return; }
    storage()?.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* quota / disabled storage must never break auth */ }
}

export function clearStoredUser() {
  try { storage()?.removeItem(USER_KEY); } catch { /* ignore */ }
}

/** Atomically persist a new session (token + cached user) with a single notify. */
export function setSession(token, user) {
  storage()?.setItem(KEY, token);
  setStoredUser(user);
  emit();
}

/** Clear the whole session (token + cached user) with a single notify. */
export function clearSession() {
  storage()?.removeItem(KEY);
  storage()?.removeItem(USER_KEY);
  emit();
}

/** Subscribe to token changes; returns an unsubscribe function. */
export function subscribeToToken(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
