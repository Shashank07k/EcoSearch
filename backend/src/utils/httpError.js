/**
 * Error with an HTTP status, understood by the centralized error handler
 * (src/middleware/errorHandler.js). Optional `details` carries field-level
 * validation messages.
 */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (details) this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = 'Authentication required') => new HttpError(401, message);
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new HttpError(403, message);
export const conflict = (message) => new HttpError(409, message);
export const notFoundError = (message = 'Resource not found') => new HttpError(404, message);
export const serviceUnavailable = (message) => new HttpError(503, message);
