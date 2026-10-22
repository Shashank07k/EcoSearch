import { apiRequest } from './apiClient.js';

export function compareProducts(productIds, { signal } = {}) {
  if (!Array.isArray(productIds) || productIds.length < 2) {
    throw new Error('Select at least 2 products to compare.');
  }
  return apiRequest('/products/compare', { params: { ids: productIds.join(',') }, signal });
}

export function recommendProducts(productIds, { signal } = {}) {
  if (!Array.isArray(productIds) || productIds.length < 2) {
    throw new Error('Select at least 2 products for a recommendation.');
  }
  return apiRequest('/products/recommend', { method: 'POST', body: { productIds }, signal });
}
