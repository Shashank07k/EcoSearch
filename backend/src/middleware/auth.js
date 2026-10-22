import mongoose from 'mongoose';
import User, { USER_ROLES } from '../models/User.js';
import { verifyToken } from '../services/token.service.js';
import { HttpError } from '../utils/httpError.js';

function bearerToken(header) {
  if (typeof header !== 'string' || header.trim().length === 0) {
    throw new HttpError(401, 'Authentication required');
  }
  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || parts[1].length === 0) {
    throw new HttpError(401, 'Malformed authorization header. Use: Bearer <token>');
  }
  return parts[1];
}

/**
 * If a Bearer token is present, authenticate as usual. If none is sent, continue
 * anonymously (req.user stays unset). Invalid tokens still return 401.
 */
export async function optionalAuthenticate(req, res, next) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || header.trim().length === 0) return next();
  return authenticate(req, res, next);
}

export async function authenticate(req, _res, next) {
  try {
    const token = bearerToken(req.headers.authorization);
    const claims = verifyToken(token);
    if (!mongoose.isObjectIdOrHexString(claims.sub)) {
      throw new HttpError(401, 'Invalid authentication token');
    }
    const user = await User.findById(claims.sub).lean();
    if (!user) throw new HttpError(401, 'Authentication required');
    const { passwordHash, ...safeUser } = user;
    // Normalize to the same public shape the API returns.
    req.user = {
      id: safeUser._id.toString(),
      name: safeUser.name,
      email: safeUser.email,
      role: safeUser.role,
      createdAt: safeUser.createdAt,
      updatedAt: safeUser.updatedAt,
    };
    next();
  } catch (error) {
    next(error);
  }
}

/** Factory for role checks. Must run after `authenticate`. */
export function requireRole(...roles) {
  const allowed = roles.length ? roles : USER_ROLES;
  return function authorize(req, _res, next) {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (!allowed.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission to perform this action'));
    }
    next();
  };
}
