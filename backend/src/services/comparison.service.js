import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Favorite from '../models/Favorite.js';
import { HttpError, badRequest, notFoundError, serviceUnavailable } from '../utils/httpError.js';

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 4;

/** Projection for products returned to the comparison page. */
export const COMPARISON_PROJECTION = {
  name: 1,
  brand: 1,
  category: 1,
  price: 1,
  imageUrl: 1,
  sustainability: 1,
  ecoAlternatives: 1,
  updatedAt: 1,
};

function assertDatabaseReady() {
  if (mongoose.connection.readyState !== 1) {
    throw serviceUnavailable('Database is not available. Please try again later.');
  }
}

function toPublic(doc) {
  if (!doc) return doc;
  const { _id, __v, ...rest } = doc;
  if (rest.sustainability) delete rest.sustainability.analysisInputHash;
  return { id: _id.toString(), ...rest };
}

/** Parse, dedupe, and validate the ids query string into ordered ObjectIds. */
export function parseComparisonIds(raw) {
  if (raw === undefined || raw === null || raw === '') {
    throw badRequest('Comparison requires at least 2 product ids.');
  }
  const parts = String(raw).split(',').map((part) => part.trim()).filter(Boolean);
  const unique = Array.from(new Set(parts));
  if (unique.length < MIN_COMPARE) {
    throw badRequest(`Select at least ${MIN_COMPARE} products to compare.`);
  }
  if (unique.length > MAX_COMPARE) {
    throw badRequest(`Compare at most ${MAX_COMPARE} products.`);
  }
  if (!unique.every((id) => mongoose.isObjectIdOrHexString(id))) {
    throw badRequest('One or more product ids are invalid.');
  }
  return unique;
}

/**
 * Fetch all requested products in a single MongoDB query and return them in
 * the original requested order (minus any duplicates that were deduped).
 */
export async function loadComparisonProducts(ids) {
  assertDatabaseReady();
  const products = await Product.find({ _id: { $in: ids } }, COMPARISON_PROJECTION).lean();
  const byId = new Map(products.map((p) => [p._id.toString(), p]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean).map(toPublic);
  if (ordered.length !== ids.length) {
    throw notFoundError('One or more products in this comparison could not be found.');
  }
  return ordered;
}

export async function compareProducts(rawIds) {
  const ids = parseComparisonIds(rawIds);
  const products = await loadComparisonProducts(ids);
  return { products };
}

/** Stamp `favorited` onto each product for an authenticated user (one query). */
export async function attachComparisonFavoriteFlags(userId, products) {
  if (!userId || !Array.isArray(products) || products.length === 0) return products;
  const ids = products.map((p) => p.id).filter((id) => mongoose.isObjectIdOrHexString(id));
  if (ids.length === 0) return products;
  const rows = await Favorite.find({ user: userId, product: { $in: ids } }).select('product').lean();
  const set = new Set(rows.map((row) => row.product.toString()));
  return products.map((p) => ({ ...p, favorited: set.has(p.id) }));
}
