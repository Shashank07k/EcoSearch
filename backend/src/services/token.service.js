import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

// Minimum secret length protects development environments from trivial secrets.
const MIN_SECRET_LENGTH = 16;

export function assertJwtConfigured() {
  if (typeof config.jwt.secret !== 'string' || config.jwt.secret.length < MIN_SECRET_LENGTH) {
    throw new HttpError(
      503,
      'Authentication is not configured correctly. Please contact the application operator.',
    );
  }
}

/** Create a signed access token. Claims carry id/role only; never a password. */
export function generateToken(user) {
  assertJwtConfigured();
  const id = user?._id?.toString?.() || user?.id;
  if (!id) throw new HttpError(500, 'Could not create an authentication token.');
  return jwt.sign({ sub: id, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/** Verify a token and return its claims. Throws clean 401 errors on failure. */
export function verifyToken(token) {
  assertJwtConfigured();
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    if (typeof payload?.sub !== 'string') throw new Error('missing subject');
    return payload;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error?.name === 'TokenExpiredError') {
      throw new HttpError(401, 'Authentication token has expired. Please sign in again.');
    }
    throw new HttpError(401, 'Invalid authentication token');
  }
}
