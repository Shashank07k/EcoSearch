import mongoose from 'mongoose';
import SearchHistory from '../models/SearchHistory.js';
import { notFoundError, serviceUnavailable } from '../utils/httpError.js';
import { DEFAULT_LIMIT } from '../utils/pagination.js';

function assertDatabaseReady() {
  if (mongoose.connection.readyState !== 1) {
    throw serviceUnavailable('Database is not available. Please try again later.');
  }
}

/** Repeated identical searches within this window update the existing row. */
export const HISTORY_DEDUP_WINDOW_MS = 10 * 60 * 1000;

export function normalizeSearchQuery(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function toPublic(doc) {
  if (!doc) return doc;
  const { _id, __v, normalizedQuery, user, ...rest } = doc;
  return {
    id: _id.toString(),
    query: rest.query,
    resultCount: rest.resultCount,
    searchedAt: rest.searchedAt,
  };
}

/**
 * Record a successful catalog search for an authenticated user.
 * Never throws to the caller of product search — wrap at the controller.
 */
export async function recordSearch({ userId, query, resultCount }) {
  assertDatabaseReady();
  const trimmed = typeof query === 'string' ? query.trim() : '';
  const normalizedQuery = normalizeSearchQuery(trimmed);
  if (!normalizedQuery || normalizedQuery.length < 2) return null;
  const count = Number.isFinite(resultCount) && resultCount >= 0 ? resultCount : 0;
  const since = new Date(Date.now() - HISTORY_DEDUP_WINDOW_MS);

  const existing = await SearchHistory.findOne({
    user: userId,
    normalizedQuery,
    searchedAt: { $gte: since },
  }).sort({ searchedAt: -1 });

  if (existing) {
    existing.resultCount = count;
    existing.searchedAt = new Date();
    existing.query = trimmed;
    await existing.save();
    return existing;
  }

  return SearchHistory.create({
    user: userId,
    query: trimmed,
    normalizedQuery,
    resultCount: count,
    searchedAt: new Date(),
  });
}

export async function listHistory(userId, { page = 1, limit = DEFAULT_LIMIT } = {}) {
  assertDatabaseReady();
  const filter = { user: userId };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    SearchHistory.find(filter).sort({ searchedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    SearchHistory.countDocuments(filter),
  ]);
  return {
    items: items.map(toPublic),
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function deleteHistoryEntry(userId, id) {
  assertDatabaseReady();
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw notFoundError('History entry not found');
  }
  // Owner-scoped delete: another user's id is indistinguishable from missing.
  const deleted = await SearchHistory.findOneAndDelete({ _id: id, user: userId }).lean();
  if (!deleted) throw notFoundError('History entry not found');
  return toPublic(deleted);
}

export async function clearHistory(userId) {
  assertDatabaseReady();
  const { deletedCount } = await SearchHistory.deleteMany({ user: userId });
  return { deletedCount };
}
