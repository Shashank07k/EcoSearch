import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createHarness } from '../support/testApp.js';

const uri = process.env.TEST_MONGODB_URI;

describe('Authentication and authorization API', { skip: !uri }, () => {
  let app;
  before(async () => { app = await createHarness(); });
  after(async () => { await app?.close(); });

  const request = (path, options) => app.request(path, options);

  describe('registration', () => {
    it('registers a valid user, returns a token and never the password hash', async () => {
      const email = app.uniqueEmail('register');
      const response = await request('/auth/register', {
        method: 'POST',
        body: { name: 'Shashank', email, password: 'StrongPassword123!' },
      });
      assert.equal(response.status, 201);
      const { user, token } = response.body.data;
      assert.equal(user.email, email);
      assert.equal(user.role, 'user');
      assert.equal(typeof token, 'string');
      assert.ok(token.length > 20);
      assert.equal(user.passwordHash, undefined);
      assert.equal(JSON.stringify(response.body).includes('passwordHash'), false);
      assert.match(token, /^eyJ/);
    });

    it('ignores a client-provided admin role', async () => {
      const response = await app.register({ role: 'admin', isAdmin: true });
      assert.equal(response.status, 201);
      assert.equal(response.body.data.user.role, 'user');
    });

    it('rejects duplicate emails with 409 regardless of casing', async () => {
      const email = app.uniqueEmail('dup');
      const first = await request('/auth/register', {
        method: 'POST',
        body: { name: 'First', email: email.toUpperCase(), password: 'StrongPassword123!' },
      });
      assert.equal(first.status, 201);
      const duplicate = await request('/auth/register', {
        method: 'POST',
        body: { name: 'Second', email: `  ${email}  `, password: 'StrongPassword123!' },
      });
      assert.equal(duplicate.status, 409);
      assert.match(duplicate.body.error.message, /already exists/i);
    });

    const invalidBodies = [
      ['missing name', { email: 'x@example.com', password: 'StrongPassword123!' }],
      ['short name', { name: 'A', email: 'x@example.com', password: 'StrongPassword123!' }],
      ['missing password', { name: 'Test', email: 'x@example.com' }],
      ['short password', { name: 'Test', email: 'x@example.com', password: 'ab1' }],
      ['password without number', { name: 'Test', email: 'x@example.com', password: 'PasswordOnly' }],
      ['invalid email', { name: 'Test', email: 'not-an-email', password: 'StrongPassword123!' }],
      ['array body', ['nope']],
    ];
    for (const [label, body] of invalidBodies) {
      it(`rejects ${label} with 400`, async () => {
        const response = await request('/auth/register', { method: 'POST', body });
        assert.equal(response.status, 400, JSON.stringify(response.body));
        assert.equal(response.body.success, false);
        assert.ok(Array.isArray(response.body.error.details));
      });
    }
  });

  describe('login', () => {
    it('logs in with valid credentials', async () => {
      const email = app.uniqueEmail('login');
      await request('/auth/register', {
        method: 'POST',
        body: { name: 'Login User', email, password: 'StrongPassword123!' },
      });
      const response = await request('/auth/login', {
        method: 'POST',
        body: { email: email.toUpperCase(), password: 'StrongPassword123!' },
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.data.user.email, email);
      assert.equal(typeof response.body.data.token, 'string');
    });

    it('returns the same generic error for wrong password and unknown email', async () => {
      const email = app.uniqueEmail('known');
      await request('/auth/register', {
        method: 'POST',
        body: { name: 'Known', email, password: 'StrongPassword123!' },
      });
      const wrong = await request('/auth/login', { method: 'POST', body: { email, password: 'WrongPassword999!' } });
      const unknown = await request('/auth/login', {
        method: 'POST',
        body: { email: app.uniqueEmail('ghost'), password: 'WrongPassword999!' },
      });
      assert.equal(wrong.status, 401);
      assert.equal(unknown.status, 401);
      assert.equal(wrong.body.error.message, unknown.body.error.message);
      assert.equal(wrong.body.error.message, 'Invalid email or password');
    });

    it('rejects missing fields', async () => {
      const missingPassword = await request('/auth/login', { method: 'POST', body: { email: 'x@example.com' } });
      assert.equal(missingPassword.status, 400);
      const missingEmail = await request('/auth/login', { method: 'POST', body: { password: 'StrongPassword123!' } });
      assert.equal(missingEmail.status, 400);
    });
  });

  describe('JWT and /me', () => {
    let token;
    before(async () => {
      const response = await app.register();
      token = response.body.data.token;
    });

    it('returns the current user for a valid token', async () => {
      const response = await request('/auth/me', { token });
      assert.equal(response.status, 200);
      assert.equal(response.body.data.user.role, 'user');
      assert.equal(response.body.data.user.passwordHash, undefined);
    });

    const headerCases = [
      ['missing token', undefined],
      ['empty bearer', 'Bearer '],
      ['token without bearer scheme', 'abc.def.ghi'],
      ['wrong scheme', `Basic ${Buffer.from('a:b').toString('base64')}`],
      ['invalid token', 'Bearer definitely-not-a-token'],
      ['expired token', `Bearer ${jwt.sign({ sub: '000000000000000000000000', role: 'user' }, process.env.JWT_SECRET, { expiresIn: -10 })}`],
    ];
    for (const [label, authorization] of headerCases) {
      it(`rejects ${label}`, async () => {
        const response = await request('/auth/me', { headers: authorization ? { Authorization: authorization } : {} });
        assert.equal(response.status, 401, JSON.stringify(response.body));
        assert.equal(response.body.success, false);
      });
    }

    it('rejects a token for a deleted user', async () => {
      const registered = await app.register();
      const oneTimeToken = registered.body.data.token;
      await app.models.User.deleteOne({ email: registered.body.data.user.email });
      const response = await request('/auth/me', { token: oneTimeToken });
      assert.equal(response.status, 401);
    });

    it('never trusts a forged admin token without the real secret', async () => {
      const forged = jwt.sign({ sub: '000000000000000000000000', role: 'admin' }, 'wrong-secret-value-0000000000');
      const response = await request('/products', {
        method: 'POST',
        body: { name: 'Forged', category: 'Home' },
        headers: { Authorization: `Bearer ${forged}` },
      });
      assert.equal(response.status, 401);
    });
  });

  describe('product endpoint authorization', () => {
    let adminToken;
    let userToken;

    before(async () => {
      const admin = await app.createAdmin();
      adminToken = admin.token;
      userToken = (await app.register()).body.data.token;
    });

    it('allows public catalog reads without a token', async () => {
      assert.equal((await request('/products')).status, 200);
      assert.equal((await request('/products/search?q=water')).status, 200);
    });

    it('allows admins to create, update and delete products', async () => {
      const created = await request('/products', {
        method: 'POST',
        token: adminToken,
        body: { name: 'Admin Product', category: 'Home', price: 5 },
      });
      assert.equal(created.status, 201);
      const id = created.body.product.id;
      assert.equal((await request(`/products/${id}`, { method: 'PUT', token: adminToken, body: { price: 6 } })).status, 200);
      assert.equal((await request(`/products/${id}`, { method: 'DELETE', token: adminToken })).status, 200);
    });

    it('forbids normal users from admin operations (403)', async () => {
      const post = await request('/products', {
        method: 'POST',
        token: userToken,
        body: { name: 'User Product', category: 'Home' },
      });
      assert.equal(post.status, 403);
      const fakeId = '000000000000000000000000';
      assert.equal((await request(`/products/${fakeId}`, { method: 'PUT', token: userToken, body: { price: 1 } })).status, 403);
      assert.equal((await request(`/products/${fakeId}`, { method: 'DELETE', token: userToken })).status, 403);
    });

    it('requires authentication for AI analysis but allows any logged-in user', async () => {
      const created = await request('/products', {
        method: 'POST',
        token: adminToken,
        body: { name: 'Analyzable', category: 'Home', description: 'Reusable item' },
      });
      const id = created.body.product.id;
      assert.equal((await request(`/products/${id}/analyze`, { method: 'POST' })).status, 401);
      const analyzed = await request(`/products/${id}/analyze`, { method: 'POST', token: userToken });
      assert.equal(analyzed.status, 200);
      assert.equal(analyzed.body.data.score, 84);
    });
  });
});
