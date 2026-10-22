export class ApiError extends Error {
  constructor(message, { status, details, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code = code;
  }
}
