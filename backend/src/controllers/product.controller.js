import * as productService from '../services/product.service.js';
import { MAX_PAGE_LIMIT, DEFAULT_PAGE_LIMIT } from '../services/product.service.js';
import { attachFavoriteFlags } from '../services/favorite.service.js';
import { recordSearch } from '../services/history.service.js';
import { parsePositiveInt } from '../utils/pagination.js';

/** GET /api/products?page=1&limit=10 */
export async function listProducts(req, res) {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const result = await productService.getProducts({ page, limit });
  if (req.user) {
    result.products = await attachFavoriteFlags(req.user.id, result.products);
  }
  res.json({ success: true, ...result });
}

/** GET /api/products/search?q=water */
export async function searchProducts(req, res) {
  const q = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const { query, results } = await productService.searchProducts(q);
  let payload = results;
  if (req.user) {
    payload = await attachFavoriteFlags(req.user.id, results);
    try {
      await recordSearch({ userId: req.user.id, query, resultCount: payload.length });
    } catch (error) {
      console.error('[history] failed to record search:', error?.message);
    }
  }
  res.json({ success: true, query, count: payload.length, results: payload });
}

/** GET /api/products/:id */
export async function getProduct(req, res) {
  const product = await productService.getProductById(req.params.id);
  if (req.user) {
    const [withFlag] = await attachFavoriteFlags(req.user.id, [product]);
    return res.json({ success: true, product: withFlag });
  }
  res.json({ success: true, product });
}

/** POST /api/products */
export async function createProduct(req, res) {
  const product = await productService.createProduct(req.body);
  res.status(201).json({ success: true, product });
}

/** PUT /api/products/:id */
export async function updateProduct(req, res) {
  const product = await productService.updateProduct(req.params.id, req.body);
  res.json({ success: true, product });
}

/** DELETE /api/products/:id */
export async function deleteProduct(req, res) {
  await productService.deleteProduct(req.params.id);
  res.json({ success: true, message: 'Product deleted' });
}
