import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail, passwordIssues, validateCredentials } from '../src/utils/validation.js';

test('email validation accepts normal addresses and rejects bad input', () => {
  assert.equal(isValidEmail('User@Example.COM'), true);
  assert.equal(isValidEmail('a@b.co'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail(null), false);
});

test('password policy mirrors the backend: 8+ chars, letter and number', () => {
  assert.deepEqual(passwordIssues('StrongPassword1'), []);
  assert.match(passwordIssues('short1').join(), /8/);
  assert.match(passwordIssues('allletters').join(), /number/);
  assert.match(passwordIssues('12345678').join(), /letter/);
});

test('register validation requires name, email and password; login requires email/password', () => {
  assert.deepEqual(Object.keys(validateCredentials(
    { name: 'Shashank', email: 'u@example.com', password: 'StrongPassword1' },
    { register: true },
  )), []);
  const registerErrors = validateCredentials({ name: 'A', email: 'bad', password: 'x' }, { register: true });
  assert.ok(registerErrors.name);
  assert.ok(registerErrors.email);
  assert.ok(registerErrors.password);

  const loginMissing = validateCredentials({ email: '', password: '' }, { register: false });
  assert.ok(loginMissing.email);
  assert.ok(loginMissing.password);
  // Login does not enforce strength, only presence.
  assert.deepEqual(validateCredentials({ email: 'u@example.com', password: 'whatever' }, { register: false }), {});
});
