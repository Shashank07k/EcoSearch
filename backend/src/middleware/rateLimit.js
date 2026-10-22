import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

/**
 * Lightweight in-memory throttling for register/login. This is deliberately
 * simple (single process). A multi-instance deployment should additionally
 * rate limit at the reverse proxy / API gateway.
 *
 * Skipped under NODE_ENV=test so the automated suite is not throttled.
 */
export const authRateLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  max: config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'test',
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        status: 429,
        message: 'Too many authentication attempts. Please wait a few minutes and try again.',
      },
    });
  },
});
