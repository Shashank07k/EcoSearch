import { apiRequest } from './apiClient.js';

/** POST /api/auth/register — server always assigns role 'user'. */
export function register(payload) {
  return apiRequest('/auth/register', { method: 'POST', body: payload });
}

/** POST /api/auth/login */
export function login(payload) {
  return apiRequest('/auth/login', { method: 'POST', body: payload });
}

/** GET /api/auth/me — validates a stored token on application start. */
export function fetchCurrentUser({ signal } = {}) {
  return apiRequest('/auth/me', { signal });
}
