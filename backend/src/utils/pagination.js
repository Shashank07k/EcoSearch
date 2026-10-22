export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

export function parsePositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function parsePagination(query = {}) {
  const page = parsePositiveInt(query.page, DEFAULT_PAGE);
  const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  return { page, limit };
}
