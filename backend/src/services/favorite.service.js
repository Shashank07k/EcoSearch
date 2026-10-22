import mongoose from 'mongoose';
import Favorite from '../models/Favorite.js';
import Product from '../models/Product.js';
import { notFoundError, serviceUnavailable } from '../utils/httpError.js';
import { DEFAULT_LIMIT } from '../utils/pagination.js';

function assertDatabaseReady() {
  if (mongoose.connection.readyState !== 1) {
    throw serviceUnavailable('Database is not available. Please try again later.');
  }
}

function publicProduct(doc) {
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  if (rest.sustainability) delete rest.sustainability.analysisInputHash;
  return { id: _id.toString(), ...rest };
}

function publicFavorite(doc, product) {
  const id = doc._id?.toString?.() || doc.id;
  const rawProduct = product || doc.product;
  let publicProd = rawProduct;
  if (rawProduct && typeof rawProduct === 'object' && (rawProduct._id || rawProduct.id)) {
    publicProd = rawProduct.id ? rawProduct : publicProduct(rawProduct);
  } else if (rawProduct) {
    publicProd = rawProduct.toString();
  }
  return { id, product: publicProd, createdAt: doc.createdAt };
}

/** Single extra query (not N+1) that stamps `favorited` onto a product list. */
export async function attachFavoriteFlags(userId, products) {
  if (!userId || !Array.isArray(products) || products.length === 0) {
    return products;
  }
  const ids = products.map((p) => p.id).filter((id) => mongoose.isObjectIdOrHexString(id));
  if (ids.length === 0) return products.map((p) => ({ ...p, favorited: false }));
  const rows = await Favorite.find({ user: userId, product: { $in: ids } }).select('product').lean();
  const set = new Set(rows.map((row) => row.product.toString()));
  return products.map((p) => ({ ...p, favorited: set.has(p.id) }));
}

export async function addFavorite(userId, productId) {
  assertDatabaseReady();
  if (!mongoose.isObjectIdOrHexString(productId)) throw notFoundError('Product not found');
  const product = await Product.findById(productId).lean();
  if (!product) throw notFoundError('Product not found');

  try {
    const created = await Favorite.create({ user: userId, product: productId });
    return { created: true, favorite: publicFavorite(created.toObject(), publicProduct(product)) };
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Favorite.findOne({ user: userId, product: productId }).lean();
      return { created: false, favorite: publicFavorite(existing, publicProduct(product)) };
    }
    throw error;
  }
}

export async function removeFavorite(userId, productId) {
  assertDatabaseReady();
  if (!mongoose.isObjectIdOrHexString(productId)) throw notFoundError('Product not found');
  await Favorite.deleteOne({ user: userId, product: productId });
  return { favorited: false };
}

export async function isFavorited(userId, productId) {
  assertDatabaseReady();
  if (!mongoose.isObjectIdOrHexString(productId)) throw notFoundError('Product not found');
  const exists = await Favorite.exists({ user: userId, product: productId });
  return { favorited: Boolean(exists) };
}

export async function listFavorites(userId, { page = 1, limit = DEFAULT_LIMIT } = {}) {
  assertDatabaseReady();
  const filter = { user: userId };
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    Favorite.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate('product')
      .lean(),
    Favorite.countDocuments(filter),
  ]);
  // Drop rows whose product was deleted (cascade should prevent this).
  const items = rows
    .filter((row) => row.product)
    .map((row) => publicFavorite(row, publicProduct(row.product)));
  return {
    items,
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function deleteFavoritesForProduct(productId) {
  if (!mongoose.isObjectIdOrHexString(productId)) return { deletedCount: 0 };
  const { deletedCount } = await Favorite.deleteMany({ product: productId });
  return { deletedCount };
}
