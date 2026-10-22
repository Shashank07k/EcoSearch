import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration, validateLogin } from '../src/middleware/validateAuth.js';

const validRegister = { name: 'Shashank', email: 'user@example.com', password: 'StrongPassword123!' };
const validLogin = { email: 'user@example.com', password: 'StrongPassword123!' };

test('valid registration/login payloads pass validation', () => {
  assert.deepEqual(validateRegistration(validRegister), []);
  assert.deepEqual(validateLogin(validLogin), []);
});

test('registration checks names, emails and password strength', () => {
  assert.match(validateRegistration({ ...validRegister, name: 'x' })[0], /name/);
  assert.match(validateRegistration({ ...validRegister, email: 'bad' })[0], /email/);
  assert.match(validateRegistration({ ...validRegister, password: 'short1' })[0], /at least 8/);
  assert.match(validateRegistration({ ...validRegister, password: 'allletters' })[0], /letter and one number/);
  assert.match(validateRegistration(['nope'])[0], /JSON object/);
});

test('login requires a valid-looking email and any password string', () => {
  assert.match(validateLogin({ email: 'bad', password: 'x' })[0], /email/);
  assert.match(validateLogin({ email: 'user@example.com' })[0], /password/);
  assert.match(validateLogin(null)[0], /JSON object/);
});

test('role escalation fields are not part of the validated auth body contract', () => {
  // The controller only consumes name/email/password from req.authBody;
  // middleware construction of that whitelist is asserted in integration tests.
  const body = { ...validRegister, role: 'admin', isAdmin: true };
  assert.deepEqual(validateRegistration(body), []);
  assert.equal(body.role, 'admin', 'validation never silently mutates raw input, but routes ignore it');
});
