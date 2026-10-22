import { apiRequest } from './apiClient.js';

/** GET /api/products/search?q=… → { query, count, results } */
export function searchProducts(query, { signal } = {}) {
  return apiRequest('/products/search', { params: { q: query }, signal });
}

/** GET /api/products?page=&limit= → { products, page, limit, total, totalPages } */
export function getProducts({ page = 1, limit = 10 } = {}, { signal } = {}) {
  return apiRequest('/products', { params: { page, limit }, signal });
}

/** GET /api/products/:id → { product } */
export function getProductById(id, { signal } = {}) {
  return apiRequest(`/products/${encodeURIComponent(id)}`, { signal });
}
