import { apiRequest } from './apiClient.js';

export function getHistory({ page = 1, limit = 10 } = {}, { signal } = {}) {
  return apiRequest('/history', { params: { page, limit }, signal });
}

export function deleteHistoryEntry(id) {
  return apiRequest(`/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function clearHistory() {
  return apiRequest('/history', { method: 'DELETE' });
}
