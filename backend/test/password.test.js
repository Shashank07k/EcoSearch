import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, BCRYPT_ROUNDS } from '../src/utils/password.js';

test('passwords are bcrypt-hashed with a suitable work factor and never plaintext', async () => {
  const password = 'StrongPassword123!';
  const hash = await hashPassword(password);
  assert.equal(BCRYPT_ROUNDS, 12);
  assert.match(hash, /^\$2[aby]\$12\$/);
  assert.notEqual(hash, password);
  assert.ok(!hash.includes(password));
});

test('hashing the same password twice uses different salts and both verify', async () => {
  const password = 'RepeatedPassword9';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password, second), true);
});

test('wrong and malformed inputs fail verification rather than throwing', async () => {
  const hash = await hashPassword('CorrectPassword9');
  assert.equal(await verifyPassword('IncorrectPassword9', hash), false);
  assert.equal(await verifyPassword(undefined, hash), false);
  assert.equal(await verifyPassword('CorrectPassword9', undefined), false);
  assert.equal(await verifyPassword('', ''), false);
});
