import { config } from '../../config/env.js';
import { createLlmProvider } from './llmProvider.js';

/** Provider selection lives here, not in a controller or the domain service. */
export function getAIProvider() {
  return createLlmProvider(config.ai);
}

/**
 * Return a provider only when the AI environment is configured.
 * Used by the recommendation endpoint, which treats AI as optional.
 */
export function getProviderForRecommendation() {
  if (typeof config.ai.apiKey !== 'string' || config.ai.apiKey.length < 16) return null;
  try {
    return createLlmProvider(config.ai);
  } catch {
    return null;
  }
}
