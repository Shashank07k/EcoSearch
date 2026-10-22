import * as historyService from '../services/history.service.js';
import { parsePagination } from '../utils/pagination.js';

/** GET /api/history */
export async function listHistory(req, res) {
  const { page, limit } = parsePagination(req.query);
  const result = await historyService.listHistory(req.user.id, { page, limit });
  res.json({ success: true, data: result });
}

/** DELETE /api/history/:id */
export async function deleteHistoryEntry(req, res) {
  await historyService.deleteHistoryEntry(req.user.id, req.params.id);
  res.json({ success: true, message: 'History entry deleted' });
}

/** DELETE /api/history */
export async function clearHistory(req, res) {
  const { deletedCount } = await historyService.clearHistory(req.user.id);
  res.json({ success: true, data: { deletedCount } });
}
