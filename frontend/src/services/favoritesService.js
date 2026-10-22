import { apiRequest } from './apiClient.js';

export function getFavorites({ page = 1, limit = 12 } = {}, { signal } = {}) {
  return apiRequest('/favorites', { params: { page, limit }, signal });
}

export function getFavoriteState(productId, { signal } = {}) {
  return apiRequest(`/favorites/${encodeURIComponent(productId)}`, { signal });
}

export function addFavorite(productId) {
  return apiRequest(`/favorites/${encodeURIComponent(productId)}`, { method: 'POST' });
}

export function removeFavorite(productId) {
  return apiRequest(`/favorites/${encodeURIComponent(productId)}`, { method: 'DELETE' });
}
