import { HttpError } from '../../utils/httpError.js';

// Fixed, public-safe messages only. Never attach a provider response or cause.
const ERRORS = {
  AI_UNAVAILABLE: [503, 'AI analysis is not available right now. The product catalog is still available.'],
  AI_CONFIGURATION_ERROR: [503, 'AI analysis is not configured correctly. Please contact the application operator.'],
  AI_TIMEOUT: [504, 'AI analysis took too long. Please try again.'],
  AI_PROVIDER_ERROR: [502, 'The AI provider could not complete the analysis. Please try again.'],
  AI_INVALID_RESPONSE: [502, 'The AI returned an invalid analysis. Nothing was saved. Please try again.'],
  ANALYSIS_SAVE_FAILED: [503, 'The analysis could not be saved. Please try again.'],
  PRODUCT_CHANGED: [409, 'This product changed during analysis. Please try again with its current information.'],
};

export class AnalysisError extends HttpError {
  constructor(code) {
    const [status, message] = ERRORS[code] || ERRORS.AI_PROVIDER_ERROR;
    super(status, message);
    this.code = Object.hasOwn(ERRORS, code) ? code : 'AI_PROVIDER_ERROR';
  }
}
