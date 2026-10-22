import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env.js';
import { generateToken, verifyToken } from '../src/services/token.service.js';

const user = { _id: '507f1f77bcf86cd799439011', role: 'user' };

test('generated tokens verify and carry only subject and role claims', () => {
  const token = generateToken(user);
  const payload = verifyToken(token);
  assert.equal(payload.sub, user._id);
  assert.equal(payload.role, 'user');
  assert.equal(payload.passwordHash, undefined);
});

test('malformed and foreign-signed tokens are rejected with 401', () => {
  assert.throws(() => verifyToken('not-a-jwt'), { status: 401 });
  const foreign = jwt.sign({ sub: user._id, role: 'admin' }, 'another-secret-value-0000000000');
  assert.throws(() => verifyToken(foreign), { status: 401 });
});

test('expired tokens are rejected with an expiry message', async () => {
  const expired = jwt.sign({ sub: user._id, role: 'user' }, config.jwt.secret, { expiresIn: -1 });
  assert.throws(() => verifyToken(expired), {
    status: 401,
    message: /expired/i,
  });
});

test('missing or weak JWT configuration fails safely without exposing internals', () => {
  const original = config.jwt.secret;
  try {
    config.jwt.secret = '';
    assert.throws(() => generateToken(user), { status: 503 });
    assert.throws(() => verifyToken('anything'), { status: 503 });
    config.jwt.secret = 'short';
    assert.throws(() => generateToken(user), { status: 503 });
  } finally {
    config.jwt.secret = original;
  }
});

test('token generation requires a user id', () => {
  assert.throws(() => generateToken({ role: 'user' }), { status: 500 });
});
