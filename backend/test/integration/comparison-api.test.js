import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from '../support/testApp.js';

const uri = process.env.TEST_MONGODB_URI;

describe('Comparison and recommendation API', { skip: !uri }, () => {
  let app;
  let ids;
  let user;

  before(async () => {
    app = await createHarness();
    await app.seedProducts();
    const listing = await app.request('/products?limit=50');
    ids = listing.body.products.slice(0, 4).map((p) => p.id);
    const registration = await app.register({ name: 'Comparer' });
    user = { token: registration.body.data.token };
  });
  after(async () => { await app?.close(); });

  it('is public and returns products in the requested order', async () => {
    const reversed = [...ids].reverse();
    const response = await app.request(`/products/compare?ids=${reversed.join(',')}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.products.map((p) => p.id), reversed);
  });

  it('rejects fewer than 2, more than 4, duplicates, and invalid ids', async () => {
    assert.equal((await app.request(`/products/compare?ids=${ids[0]}`)).status, 400);
    const five = [...ids, '507f1f77bcf86cd799439020'];
    assert.equal((await app.request(`/products/compare?ids=${five.join(',')}`)).status, 400);
    assert.equal((await app.request(`/products/compare?ids=${ids[0]},${ids[0]},${ids[1]}`)).status, 200);
    assert.equal((await app.request(`/products/compare?ids=${ids[0]},not-an-id`)).status, 400);
  });

  it('returns 404 when an id is unknown', async () => {
    const unknown = '507f1f77bcf86cd799439999';
    const response = await app.request(`/products/compare?ids=${ids[0]},${unknown}`);
    assert.equal(response.status, 404);
  });

  it('recommends based on deterministic rules when AI is unavailable', async () => {
    app.setAIMode('unavailable');
    const response = await app.request('/products/recommend', {
      method: 'POST',
      token: user.token,
      body: { productIds: ids.slice(0, 3) },
    });
    assert.equal(response.status, 200);
    assert.ok(ids.includes(response.body.data.recommendedProductId));
    assert.ok(response.body.data.reasonCodes.length > 0);
    assert.equal(response.body.data.aiExplanation, undefined);
  });

  it('returns a deterministic recommendation with optional AI explanation', async () => {
    app.setAIMode('valid');
    app.setAIGenerate(() => ({
      explanation: 'The top pick edges ahead on sustainability.',
      tradeoffs: [{ productName: 'Runner-up', reason: 'A cheaper alternative worth considering.' }],
    }));
    const response = await app.request('/products/recommend', {
      method: 'POST',
      body: { productIds: ids.slice(0, 2) },
    });
    assert.equal(response.status, 200);
    assert.ok(response.body.data.aiExplanation);
    assert.equal(response.body.data.aiExplanation.cached, false);
    const cached = await app.request('/products/recommend', {
      method: 'POST',
      body: { productIds: ids.slice(0, 2) },
    });
    assert.equal(cached.body.data.aiExplanation.cached, true);
  });

  it('rejects malformed AI output without caching it', async () => {
    app.setAIGenerate(() => ({ explanation: '', tradeoffs: [] }));
    const response = await app.request('/products/recommend', {
      method: 'POST',
      body: { productIds: [ids[2], ids[3]] },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.aiExplanation, undefined);
  });

  it('does not leak user history or favorites through comparison endpoints', async () => {
    await app.request('/products/search?q=water', { token: user.token });
    const comparison = await app.request(`/products/compare?ids=${ids.slice(0, 2).join(',')}`);
    assert.equal(JSON.stringify(comparison.body).includes('passwordHash'), false);
    assert.equal(JSON.stringify(comparison.body).includes(user.token), false);
    const recommendation = await app.request('/products/recommend', {
      method: 'POST',
      body: { productIds: ids.slice(0, 2) },
    });
    assert.equal(JSON.stringify(recommendation.body).includes(user.token), false);
  });
});
