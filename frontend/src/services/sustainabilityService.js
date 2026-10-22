import { apiRequest, ApiError } from './apiClient.js';
import { isAnalysisResponse } from '../utils/analysis.js';

export async function analyzeSustainability(id, { signal } = {}) {
  const response = await apiRequest(`/products/${encodeURIComponent(id)}/analyze`, {
    method: 'POST', signal,
  });
  if (!isAnalysisResponse(response)) {
    throw new ApiError('The analysis response was incomplete or invalid. Please try again.', { code: 'INVALID_RESPONSE' });
  }
  return response;
}
