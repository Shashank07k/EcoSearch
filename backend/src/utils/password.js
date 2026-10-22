import bcrypt from 'bcryptjs';

// Cost factor 12 (~250-400ms per hash on typical developer hardware in 2026).
export const BCRYPT_ROUNDS = 12;

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(plainPassword, passwordHash) {
  if (typeof plainPassword !== 'string' || typeof passwordHash !== 'string') return false;
  return bcrypt.compare(plainPassword, passwordHash);
}
