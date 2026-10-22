import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables from backend/.env (see .env.example).
// Resolve the file relative to THIS module so the backend works no matter which
// directory it was started from (e.g. `node backend/src/server.js` from the repo
// root). Falling back to process.cwd()/.env keeps existing setups working.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env') });
dotenv.config();

const raw = process.env;

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Centralized application configuration.
 *
 * This is the only module in the codebase that reads `process.env` directly.
 * Everything else imports its settings from here.
 */
export const config = {
  nodeEnv: raw.NODE_ENV || 'development',
  port: toInt(raw.PORT, 5000),
  mongodbUri: raw.MONGODB_URI || '',
  corsOrigin: raw.CORS_ORIGIN || '*',
  // Optional at startup. Validated only when an uncached analysis is requested.
  ai: {
    apiKey: raw.AI_API_KEY?.trim() || '',
    model: raw.AI_MODEL?.trim() || 'gemini-2.5-flash',
    baseUrl: raw.AI_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta/openai/',
    timeoutMs: 20_000,
    // Comma-separated list of verified fallback models tried when the primary
    // returns a transient availability error (429/503). Example:
    //   AI_FALLBACK_MODELS=gemini-2.5-flash,gemini-3.5-flash-lite
    fallbackModels: (raw.AI_FALLBACK_MODELS?.trim() || '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
  },
  jwt: {
    secret: raw.JWT_SECRET || '',
    expiresIn: raw.JWT_EXPIRES_IN?.trim() || '1d',
  },
  // Basic throttling on register/login. 20 attempts per 15 minutes per IP.
  authRateLimitWindowMs: toInt(raw.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  authRateLimitMax: toInt(raw.AUTH_RATE_LIMIT_MAX, 20),
  // Used ONLY by `npm run create-admin`, which must be run explicitly.
  admin: {
    name: raw.ADMIN_NAME?.trim() || '',
    email: raw.ADMIN_EMAIL?.trim().toLowerCase() || '',
    password: raw.ADMIN_PASSWORD || '',
  },
};

export const isProduction = config.nodeEnv === 'production';

if (!config.mongodbUri) {
  console.warn(
    '[config] MONGODB_URI is not set. The API will start, but MongoDB ' +
      'features will be unavailable until it is configured in backend/.env.',
  );
}

if (!config.jwt.secret) {
  console.warn(
    '[config] JWT_SECRET is not set. The API starts, but registration, login ' +
      'and protected endpoints are unavailable until JWT_SECRET is configured.',
  );
}

// Safe diagnostic: log the AI configuration without revealing the key.
{
  const keyLoaded = typeof config.ai.apiKey === 'string' && config.ai.apiKey.length >= 16;
  console.info(
    `[config] AI provider: Gemini | model: ${config.ai.model} | ` +
      `base URL: ${config.ai.baseUrl} | key loaded: ${keyLoaded ? 'YES' : 'NO'}` +
      (config.ai.fallbackModels.length
        ? ` | fallbacks: ${config.ai.fallbackModels.join(', ')}`
        : ''),
  );
}
