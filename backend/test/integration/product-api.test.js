import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createHarness } from '../support/testApp.js';
import { demoProducts } from '../../src/scripts/seedData.js';

const uri = process.env.TEST_MONGODB_URI;

describe('Real MongoDB + Express product regression and analysis API', { skip: !uri }, () => {
  let app;
  let admin;
  let user;

  before(async () => {
    app = await createHarness();
    admin = await app.createAdmin();
    const registered = await app.register({ name: 'Normal User' });
    user = { token: registered.body.data.token, id: registered.body.data.user.id };
  });
  after(async () => { await app?.close(); });

  // Provider error modes must never leak between tests; data is intentionally kept.
  beforeEach(() => { app.setAIMode('valid'); app.setAIGenerate(null); });

  const request = (path, options) => app.request(path, options);
  const createProduct = async (product = demoProducts[0], token = admin.token) => {
    const response = await request('/products', { method: 'POST', body: product, token });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.product.id;
  };
  const analyze = (id, token = user.token) => request(`/products/${id}/analyze`, { method: 'POST', token });

  it('public health, seeded list, pagination, search, no matches and IDs work without a token', async () => {
    await app.seedProducts();
    assert.equal(await app.models.Product.countDocuments(), demoProducts.length);
    assert.equal((await request('/health')).body.database.connected, true);
    const listing = await request('/products?page=1&limit=5');
    assert.equal(listing.body.total, demoProducts.length);
    assert.equal(listing.body.totalPages, Math.ceil(demoProducts.length / 5));
    assert.equal(listing.body.products.length, 5);
    const result = await request('/products/search?q=WATER');
    assert.equal(result.status, 200);
    const bottle = result.body.results.find((p) => p.name === 'Stainless Steel Water Bottle');
    assert.ok(bottle.id);
    assert.equal(bottle._id, undefined);
    assert.equal(bottle.__v, undefined);
    assert.equal((await request(`/products/${bottle.id}`)).status, 200);
    assert.deepEqual((await request('/products/search?q=zzzzqq')).body.results, []);
    assert.equal((await request('/products/search?q=a')).status, 400);
    assert.equal((await request('/products/search')).status, 400);
    assert.equal(app.aiCalls(), 0);
  });

  it('product writes require admin authentication and role', async () => {
    // Unauthenticated → 401
    let response = await request('/products', { method: 'POST', body: demoProducts[1] });
    assert.equal(response.status, 401);
    assert.equal(response.body.error.message, 'Authentication required');

    // Normal user → 403
    response = await request('/products', { method: 'POST', body: demoProducts[1], token: user.token });
    assert.equal(response.status, 403);
    assert.match(response.body.error.message, /permission/);

    // Malformed/expired-style invalid token → 401
    response = await request('/products', {
      method: 'POST',
      body: demoProducts[1],
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    assert.equal(response.status, 401);

    // Admin → 201
    const id = await createProduct(demoProducts[2]);
    assert.equal((await request(`/products/${id}`, { method: 'PUT', body: { price: 10 }, token: user.token })).status, 403);
    assert.equal((await request(`/products/${id}`, { method: 'PUT', body: { price: 10 } })).status, 401);
    assert.equal((await request(`/products/${id}`, { method: 'PUT', body: { price: 10 }, token: admin.token })).status, 200);
    assert.equal((await request(`/products/${id}`, { method: 'DELETE', token: user.token })).status, 403);
    assert.equal((await request(`/products/${id}`, { method: 'DELETE', token: admin.token })).status, 200);
  });

  it('AI analyze requires authentication; fresh response is validated, persisted and cached across restarts', async () => {
    // Anonymous analysis is rejected and never reaches the provider
    const id = await createProduct();
    let response = await request(`/products/${id}/analyze`, { method: 'POST' });
    assert.equal(response.status, 401);
    assert.equal(app.aiCalls(), 0);

    // A malformed Authorization header is rejected before any AI work.
    response = await request(`/products/${id}/analyze`, {
      method: 'POST',
      headers: { Authorization: 'Token abc.def.ghi' },
    });
    assert.equal(response.status, 401);

    response = await analyze(id);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { success: true, cached: false, data: response.body.data });
    assert.equal(response.body.data.score, 84);
    const saved = await app.models.Product.findById(id).select('+sustainability.analysisInputHash').lean();
    assert.ok(saved.sustainability.analyzedAt instanceof Date);
    assert.equal(saved.ecoAlternatives[0].name, response.body.data.alternatives[0].name);

    const cached = await analyze(id);
    assert.equal(cached.body.cached, true);
    const detail = await request(`/products/${id}`);
    assert.equal(detail.body.product.sustainability.analysisInputHash, undefined);
    assert.equal(app.aiCalls(), 1);
  });

  it('invalid ObjectId and unknown product return clean errors', async () => {
    assert.equal((await analyze('invalid')).status, 400);
    assert.equal((await analyze(new mongoose.Types.ObjectId().toString())).status, 404);
  });

  it('provider failure is isolated from public catalog and is retryable', async () => {
    const id = await createProduct();
    app.setAIMode('failure');
    const failed = await analyze(id);
    assert.equal(failed.status, 502);
    assert.equal(failed.body.error.code, 'AI_PROVIDER_ERROR');
    assert.ok(!JSON.stringify(failed.body).includes('private'));
    assert.equal((await app.models.Product.findById(id).lean()).sustainability.analyzedAt, undefined);
    assert.equal((await request('/products/search?q=water')).status, 200);
    app.setAIMode('valid');
    assert.equal((await analyze(id)).status, 200);
  });

  it('invalid AI output never changes stored product data', async () => {
    const id = await createProduct();
    const before = await app.models.Product.findById(id).lean();
    app.setAIMode('invalid');
    const response = await analyze(id);
    assert.equal(response.status, 502);
    assert.equal(response.body.error.code, 'AI_INVALID_RESPONSE');
    const after = await app.models.Product.findById(id).lean();
    assert.deepEqual(after.sustainability, before.sustainability);
  });

  it('meaningful PUT (admin) clears AI results; image-only edits retain cache', async () => {
    const id = await createProduct();
    await analyze(id);
    const updated = await request(`/products/${id}`, {
      method: 'PUT',
      body: { description: 'A different product material.' },
      token: admin.token,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.product.sustainability?.analyzedAt, undefined);
    assert.equal((await analyze(id)).body.cached, false);

    const cosmetic = await request(`/products/${id}`, {
      method: 'PUT',
      body: { imageUrl: 'https://example.com/new.jpg', name: ' Stainless Steel Water Bottle ' },
      token: admin.token,
    });
    assert.equal(cosmetic.status, 200);
    assert.equal((await analyze(id)).body.cached, true);
  });

  it('manual scores cannot forge server-owned AI metadata', async () => {
    const id = await createProduct();
    await analyze(id);
    const result = await request(`/products/${id}`, {
      method: 'PUT',
      body: {
        sustainability: {
          score: 2,
          analyzedAt: new Date().toISOString(),
          analysisVersion: 'sustainability-v1',
          analysisInputHash: 'forged',
        },
      },
      token: admin.token,
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.product.sustainability.analyzedAt, undefined);
    assert.equal((await analyze(id)).body.cached, false);
  });

  it('a concurrent product edit makes the in-flight analysis return 409', async () => {
    const id = await createProduct();
    let release;
    let started;
    const ready = new Promise((resolve) => { started = resolve; });
    app.setAIGenerate(() => new Promise((resolve) => { release = resolve; started(); }));
    const pending = analyze(id);
    await ready;
    assert.equal((await request(`/products/${id}`, { method: 'PUT', body: { name: 'Changed name' }, token: admin.token })).status, 200);
    release({ score: 80, summary: 'x'.repeat(20), factors: [], alternatives: [] });
    const response = await pending;
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'PRODUCT_CHANGED');
  });

  it('CRUD validation still rejects malformed admin input', async () => {
    for (const body of [{ category: 'Home' }, { name: 'Test' }, { name: 'Test', category: 'Home', price: -1 }]) {
      assert.equal((await request('/products', { method: 'POST', body, token: admin.token })).status, 400);
    }
  });
});
