import * as favoriteService from '../services/favorite.service.js';
import { parsePagination } from '../utils/pagination.js';

/** GET /api/favorites */
export async function listFavorites(req, res) {
  const { page, limit } = parsePagination(req.query);
  const result = await favoriteService.listFavorites(req.user.id, { page, limit });
  res.json({ success: true, data: result });
}

/** GET /api/favorites/:productId */
export async function getFavoriteState(req, res) {
  const result = await favoriteService.isFavorited(req.user.id, req.params.productId);
  res.json({ success: true, data: result });
}

/** POST /api/favorites/:productId */
export async function addFavorite(req, res) {
  const result = await favoriteService.addFavorite(req.user.id, req.params.productId);
  res.status(result.created ? 201 : 200).json({ success: true, data: result });
}

/** DELETE /api/favorites/:productId */
export async function removeFavorite(req, res) {
  const result = await favoriteService.removeFavorite(req.user.id, req.params.productId);
  res.json({ success: true, data: result });
}
