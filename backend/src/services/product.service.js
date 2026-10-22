import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Favorite from '../models/Favorite.js';
import { HttpError, badRequest, notFoundError, serviceUnavailable } from '../utils/httpError.js';
import { analysisInputHash } from './ai/analysis.cache.js';

export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 100;
export const MAX_PAGE_LIMIT = 50;
export const DEFAULT_PAGE_LIMIT = 10;
const SEARCH_RESULT_LIMIT = 50;

/** Fields returned for search results (lean summary, no heavy nested arrays). */
const SEARCH_PROJECTION = {
  name: 1,
  brand: 1,
  category: 1,
  price: 1,
  imageUrl: 1,
  'sustainability.score': 1,
  'sustainability.summary': 1,
  'sustainability.analyzedAt': 1,
  'sustainability.analysisVersion': 1,
  updatedAt: 1,
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function assertDatabaseReady() {
  if (mongoose.connection.readyState !== 1) {
    throw serviceUnavailable('Database is not available. Please try again later.');
  }
}

/** Convert a lean document to the public shape (`id`, no `_id`/`__v`). */
function toPublic(doc) {
  if (!doc) return doc;
  const { _id, __v, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

/** Wrap Mongoose validation/cast errors into clean 400 responses. */
function translateMongooseError(error) {
  if (error instanceof mongoose.Error.ValidationError) {
    return badRequest(
      'Invalid product data',
      Object.values(error.errors).map((e) => e.message),
    );
  }
  if (error instanceof mongoose.Error.CastError) {
    return badRequest(`Invalid value for ${error.path}`);
  }
  return error;
}

/**
 * Paginated product listing, newest first.
 */
export async function getProducts({ page = 1, limit = DEFAULT_PAGE_LIMIT } = {}) {
  assertDatabaseReady();

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Product.find().sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(),
  ]);

  return {
    products: items.map(toPublic),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getProductById(id) {
  assertDatabaseReady();
  const product = await Product.findById(id).lean();
  if (!product) throw notFoundError('Product not found');
  return toPublic(product);
}

export async function createProduct(data) {
  assertDatabaseReady();
  try {
    const product = await Product.create(data);
    return product.toJSON();
  } catch (error) {
    throw translateMongooseError(error);
  }
}

/**
 * PUT accepts partial bodies, so a nested `sustainability` object is merged
 * field-by-field (dot-path update) instead of replacing the whole sub-document.
 */
export function toUpdateOperation(data, current) {
  const { sustainability, ...rest } = data;
  const $set = Object.fromEntries(
    ['name', 'description', 'category', 'brand', 'price', 'imageUrl', 'ecoAlternatives']
      .filter((key) => rest[key] !== undefined).map((key) => [key, rest[key]]),
  );
  if (sustainability) {
    for (const key of ['score', 'summary', 'factors']) {
      if (sustainability[key] !== undefined) $set[`sustainability.${key}`] = sustainability[key];
    }
  }
  const inputChanged = analysisInputHash(current) !== analysisInputHash({ ...current, ...rest });
  const manuallyEdited = sustainability !== undefined || data.ecoAlternatives !== undefined;
  const $unset = {};
  if (inputChanged || manuallyEdited) {
    for (const key of ['analyzedAt', 'analysisVersion', 'analysisInputHash']) $unset[`sustainability.${key}`] = '';
  }
  if (inputChanged && (current.sustainability?.analyzedAt || current.sustainability?.analysisVersion)) {
    // Do not leave old AI conclusions looking current in the catalog.
    for (const path of ['sustainability.score', 'sustainability.summary', 'sustainability.factors', 'ecoAlternatives']) {
      if (!Object.hasOwn($set, path)) $unset[path] = '';
    }
  }
  return { $set, $inc: { __v: 1 }, ...(Object.keys($unset).length ? { $unset } : {}) };
}

export async function updateProduct(id, data) {
  assertDatabaseReady();
  try {
    const current = await Product.findById(id).lean();
    if (!current) throw notFoundError('Product not found');
    const product = await Product.findOneAndUpdate(
      { _id: id, __v: current.__v === undefined ? { $exists: false } : current.__v },
      toUpdateOperation(data, current),
      { new: true, runValidators: true, context: 'query' },
    ).lean();
    if (!product) throw new HttpError(409, 'This product was changed by another request. Please retry your update.');
    return toPublic(product);
  } catch (error) {
    throw translateMongooseError(error);
  }
}

export async function deleteProduct(id) {
  assertDatabaseReady();
  const product = await Product.findByIdAndDelete(id).lean();
  if (!product) throw notFoundError('Product not found');
  // Cascade: drop favorite rows that would otherwise point at a missing product.
  await Favorite.deleteMany({ product: id });
  return toPublic(product);
}

/**
 * Case-insensitive partial-match search across name, description, brand and
 * category — executed in MongoDB, never by scanning documents in JS.
 *
 * The query is escaped so user input is never interpreted as a regex pattern.
 */
export async function searchProducts(rawQuery) {
  assertDatabaseReady();

  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';

  if (query.length === 0) {
    throw badRequest('Search query "q" is required');
  }
  if (query.length < MIN_SEARCH_LENGTH) {
    throw badRequest(`Search query must be at least ${MIN_SEARCH_LENGTH} characters`);
  }
  if (query.length > MAX_SEARCH_LENGTH) {
    throw badRequest(`Search query must be at most ${MAX_SEARCH_LENGTH} characters`);
  }

  const pattern = new RegExp(escapeRegex(query), 'i');

  const results = await Product.find(
    {
      $or: [
        { name: pattern },
        { brand: pattern },
        { category: pattern },
        { description: pattern },
      ],
    },
    SEARCH_PROJECTION,
  )
    .sort({ 'sustainability.score': -1, name: 1 })
    .limit(SEARCH_RESULT_LIMIT)
    .lean();

  return { query, results: results.map(toPublic) };
}
