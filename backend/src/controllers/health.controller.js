import { getHealthStatus } from '../services/health.service.js';

/** GET /api/health — liveness/readiness report for the API. */
export function getHealth(_req, res) {
  res.status(200).json(getHealthStatus());
}
