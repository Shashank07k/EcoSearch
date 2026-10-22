import { AnalysisError } from '../services/ai/analysisError.js';

/**
 * 404 handler for unmatched routes. Forwards a structured error to the
 * centralized error handler below.
 */
export function notFound(req, _res, next) {
  next({ status: 404, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/**
 * Centralized Express error handler (4-argument signature is required).
 * Internal errors are logged server-side; clients only get a generic
 * message so implementation details are never leaked.
 */
export function errorHandler(error, _req, res, _next) {
  // Malformed JSON body (raised by express.json()) → clean 400.
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { status: 400, message: 'Request body must be valid JSON' },
    });
  }

  const status = typeof error?.status === 'number' ? error.status : 500;

  if (status === 500) {
    console.error('[error]', error);
  }

  const message =
    status === 500 ? 'Internal Server Error' : error?.message || 'Request failed';

  const payload = { status, message };
  // Only our fixed public-safe AI codes, never raw upstream error fields.
  if (error instanceof AnalysisError) payload.code = error.code;
  if (status !== 500 && Array.isArray(error?.details)) {
    payload.details = error.details;
  }

  res.status(status).json({ success: false, error: payload });
}
