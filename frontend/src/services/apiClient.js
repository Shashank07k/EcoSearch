import { ApiError } from './apiError.js';
import { getToken, clearToken } from './tokenStore.js';

/** Shared by Vite and the preview host. Only public API addresses go here. */
export { ApiError };

/**
 * Hard ceiling for a single API call (headers + body). Catalog browsing must
 * never wait 30s+ on a hung backend: without this, a server that accepts the
 * connection but never responds strands the UI in its loading state forever
 * (infinite skeleton cards). 12s is comfortably above normal latency
 * (measured ~5–25ms locally) while still feeling bounded to a user.
 */
export const API_TIMEOUT_MS = 12_000;

const TIMEOUT_MESSAGE =
  'EcoSearch took too long to respond. Please check your connection and try again.';

export async function apiRequest(path, { method = 'GET', body, signal, params, timeoutMs = API_TIMEOUT_MS } = {}) {
  const base = (globalThis.__ECOSEARCH_API_BASE_URL__ || '/api').replace(/\/+$/, '');
  let url;
  try {
    url = new URL(`${base}${path}`, globalThis.location?.origin || 'http://localhost');
  } catch {
    throw new ApiError('The catalog API address is not configured correctly.', { code: 'API_CONFIGURATION_ERROR' });
  }
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const token = getToken();

  // Combine the caller's signal (unmount / superseded request) with our own
  // deadline so neither a hung server nor a hung body read can block forever.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const forwardCallerAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', forwardCallerAbort, { once: true });
  }

  const abortedByCaller = () => Boolean(signal?.aborted);
  const abortError = () => new DOMException('Aborted', 'AbortError');

  let response;
  let data;
  try {
    try {
      response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      // Caller-initiated cancellation must stay an AbortError so hooks can tell
      // "superseded/unmounted" apart from a real failure.
      if (abortedByCaller()) throw abortError();
      if (timedOut) throw new ApiError(TIMEOUT_MESSAGE, { code: 'TIMEOUT' });
      if (error?.name === 'AbortError') throw new ApiError(TIMEOUT_MESSAGE, { code: 'TIMEOUT' });
      throw new ApiError('Could not reach EcoSearch. Please check your connection and try again.', { code: 'NETWORK_ERROR' });
    }

    try {
      data = await response.json();
    } catch {
      if (abortedByCaller()) throw abortError();
      if (timedOut) throw new ApiError(TIMEOUT_MESSAGE, { code: 'TIMEOUT' });
      // A non-JSON body is never the catalog contract. Distinguish the real
      // causes instead of hiding them behind "unreadable response":
      // - 5xx with an empty/text body is the dev proxy reporting the backend
      //   itself is down (Vite proxy returns a bare 500 when Express is off).
      // - 2xx non-JSON is a genuinely malformed API response.
      // - 4xx non-JSON is a misdirected request (wrong base URL / static host).
      if (response.status >= 500) {
        throw new ApiError('The EcoSearch API is temporarily unavailable. Please make sure the backend server is running and try again.', { status: response.status, code: 'API_UNAVAILABLE' });
      }
      if (response.ok) {
        throw new ApiError('EcoSearch returned an unreadable response. Please try again.', { status: response.status, code: 'INVALID_RESPONSE' });
      }
      throw new ApiError('The EcoSearch API could not be reached at the configured address. Check VITE_API_BASE_URL and try again.', { status: response.status, code: 'API_CONFIGURATION_ERROR' });
    }
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', forwardCallerAbort);
  }

  // An expired/invalid token on a protected (non-auth) request ends the session.
  // Login failures (401 on /auth/*) are handled by the form and must not loop.
  //
  // A 401 here means the server REJECTED a token that we actually sent — i.e. the
  // session ended (expired JWT, or the server's JWT secret rotated/restarted
  // after the user signed in). Ending the session is the correct behaviour, but
  // we must label it clearly: otherwise an already-signed-in user clicking
  // "Analyze Sustainability" appears to be randomly logged out with no
  // explanation, and the UI falls back to the anonymous "Sign in to analyze"
  // copy.
  const sessionExpired = response.status === 401 && !path.startsWith('/auth/');
  if (sessionExpired) {
    clearToken();
  }

  if (!response.ok) {
    throw new ApiError(
      typeof data?.error?.message === 'string' ? data.error.message : 'EcoSearch could not complete this request. Please try again.',
      { status: response.status, code: sessionExpired ? 'SESSION_EXPIRED' : data?.error?.code, details: data?.error?.details },
    );
  }
  if (!data || data.success !== true) {
    throw new ApiError('EcoSearch returned an invalid response. Please try again.', { code: 'INVALID_RESPONSE' });
  }
  return data;
}
