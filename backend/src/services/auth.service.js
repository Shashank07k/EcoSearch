import mongoose from 'mongoose';
import User, { DEFAULT_ROLE } from '../models/User.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateToken } from './token.service.js';
import { HttpError, conflict, serviceUnavailable } from '../utils/httpError.js';

// A precomputed hash keeps the "unknown email" response timing comparable to
// the "known email" path. It is never used to authenticate anyone.
const DUMMY_HASH = await hashPassword(
  `dummy-${Math.random().toString(36).slice(2)}-${Date.now()}`,
);

function assertDatabaseReady() {
  if (mongoose.connection.readyState !== 1) {
    throw serviceUnavailable('The authentication service is temporarily unavailable. Please try again later.');
  }
}

/** Public user projection; passwordHash must never leave the service layer. */
export function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

/** Register a new account. Role is always the server default: 'user'. */
export async function registerUser({ name, email, password }) {
  assertDatabaseReady();
  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await User.create({ name, email, passwordHash, role: DEFAULT_ROLE });
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict('An account with this email already exists');
    if (error?.name === 'ValidationError') {
      throw new HttpError(
        400,
        'Invalid registration data',
        Object.values(error.errors).map((e) => e.message),
      );
    }
    throw error;
  }
  const token = generateToken(user);
  return { user: publicUser(user), token };
}

/** Verify credentials. A single generic message avoids account enumeration. */
export async function loginUser({ email, password }) {
  assertDatabaseReady();
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user) {
    // Spend comparable hashing time before returning the generic failure.
    await verifyPassword(password, DUMMY_HASH);
    throw new HttpError(401, 'Invalid email or password');
  }
  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) throw new HttpError(401, 'Invalid email or password');
  const token = generateToken(user);
  return { user: publicUser(user), token };
}

export async function getUserById(id) {
  assertDatabaseReady();
  const user = await User.findById(id);
  if (!user) throw new HttpError(401, 'Authentication required');
  return publicUser(user);
}
