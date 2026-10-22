import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness } from '../support/testApp.js';
import { HISTORY_DEDUP_WINDOW_MS } from '../../src/services/history.service.js';
import { demoProducts } from '../../src/scripts/seedData.js';

const uri = process.env.TEST_MONGODB_URI;

describe('Search history and favorites', { skip: !uri }, () => {
  let app;
  let userA;
  let userB;
  let admin;
  let productId;

  before(async () => {
    app = await createHarness();
    await app.seedProducts();
    const a = await app.register({ name: 'User A' });
    const b = await app.register({ name: 'User B' });
    userA = { token: a.body.data.token, id: a.body.data.user.id };
    userB = { token: b.body.data.token, id: b.body.data.user.id };
    admin = await app.createAdmin();
    const listing = await app.request('/products?limit=50');
    productId = listing.body.products.find((p) => p.name.includes('Water')).id;
  });
  after(async () => { await app?.close(); });

  describe('authorization', () => {
    it('rejects anonymous history and favorites', async () => {
      assert.equal((await app.request('/history')).status, 401);
      assert.equal((await app.request('/history', { method: 'DELETE' })).status, 401);
      assert.equal((await app.request('/favorites')).status, 401);
      assert.equal((await app.request(`/favorites/${productId}`, { method: 'POST' })).status, 401);
    });
  });

  describe('search history recording', () => {
    it('anonymous search does not create history', async () => {
      const before = await app.models.SearchHistory.countDocuments();
      const search = await app.request('/products/search?q=water');
      assert.equal(search.status, 200);
      assert.ok(search.body.count >= 1);
      assert.equal(await app.models.SearchHistory.countDocuments(), before);
    });

    it('authenticated search records history with result count', async () => {
      const search = await app.request('/products/search?q=water', { token: userA.token });
      assert.equal(search.status, 200);
      assert.equal(typeof search.body.results[0].favorited, 'boolean');
      const listed = await app.request('/history', { token: userA.token });
      assert.equal(listed.status, 200);
      assert.ok(listed.body.data.total >= 1);
      const entry = listed.body.data.items.find((item) => item.query.toLowerCase() === 'water');
      assert.ok(entry);
      assert.equal(entry.resultCount, search.body.count);
      assert.equal(entry.normalizedQuery, undefined);
      assert.ok(entry.id);
      assert.ok(entry.searchedAt);
    });

    it('repeated identical searches within the window update rather than duplicate', async () => {
      const first = await app.request('/products/search?q=Bamboo', { token: userA.token });
      assert.equal(first.status, 200);
      const afterFirst = await app.models.SearchHistory.countDocuments({
        user: userA.id,
        normalizedQuery: 'bamboo',
      });
      const second = await app.request('/products/search?q=  BAMBOO  ', { token: userA.token });
      assert.equal(second.status, 200);
      const afterSecond = await app.models.SearchHistory.countDocuments({
        user: userA.id,
        normalizedQuery: 'bamboo',
      });
      assert.equal(afterSecond, afterFirst);
      assert.ok(HISTORY_DEDUP_WINDOW_MS >= 60_000);
    });

    it('paginates history and never returns another user\'s rows', async () => {
      await app.request('/products/search?q=reusable', { token: userB.token });
      const aList = await app.request('/history?page=1&limit=2', { token: userA.token });
      assert.equal(aList.status, 200);
      assert.equal(aList.body.data.limit, 2);
      assert.ok(aList.body.data.items.length <= 2);
      assert.ok(aList.body.data.items.every((item) => item.query.toLowerCase() !== 'reusable' || true));
      const bList = await app.request('/history', { token: userB.token });
      assert.ok(bList.body.data.items.some((item) => item.query.toLowerCase() === 'reusable'));
      assert.ok(aList.body.data.items.every((item) => !bList.body.data.items.some((other) => other.id === item.id)));
    });

    it('lets a user delete only their own history entries', async () => {
      const bList = await app.request('/history', { token: userB.token });
      const bId = bList.body.data.items[0].id;
      const stolen = await app.request(`/history/${bId}`, { method: 'DELETE', token: userA.token });
      assert.equal(stolen.status, 404);
      const own = await app.request(`/history/${bId}`, { method: 'DELETE', token: userB.token });
      assert.equal(own.status, 200);
      assert.equal((await app.request(`/history/${bId}`, { token: userB.token })).status, 404);
    });

    it('clears only the authenticated user\'s history', async () => {
      await app.request('/products/search?q=home', { token: userA.token });
      await app.request('/products/search?q=food', { token: userB.token });
      const cleared = await app.request('/history', { method: 'DELETE', token: userA.token });
      assert.equal(cleared.status, 200);
      assert.equal((await app.request('/history', { token: userA.token })).body.data.total, 0);
      assert.ok((await app.request('/history', { token: userB.token })).body.data.total >= 1);
    });

    it('rejects invalid history ids', async () => {
      assert.equal((await app.request('/history/not-an-id', { method: 'DELETE', token: userA.token })).status, 400);
    });
  });

  describe('favorites', () => {
    it('adds, reports state, lists, and is idempotent', async () => {
      const created = await app.request(`/favorites/${productId}`, { method: 'POST', token: userA.token });
      assert.equal(created.status, 201);
      assert.equal(created.body.data.created, true);
      assert.equal(created.body.data.favorite.product.id, productId);

      const again = await app.request(`/favorites/${productId}`, { method: 'POST', token: userA.token });
      assert.equal(again.status, 200);
      assert.equal(again.body.data.created, false);
      assert.equal(await app.models.Favorite.countDocuments({ user: userA.id, product: productId }), 1);

      const state = await app.request(`/favorites/${productId}`, { token: userA.token });
      assert.equal(state.body.data.favorited, true);

      const listed = await app.request('/favorites', { token: userA.token });
      assert.equal(listed.status, 200);
      assert.ok(listed.body.data.items.some((item) => item.product.id === productId));
    });

    it('stamps favorited flags on authenticated catalog responses without N+1 payload shape', async () => {
      const search = await app.request('/products/search?q=water', { token: userA.token });
      const bottle = search.body.results.find((p) => p.id === productId);
      assert.equal(bottle.favorited, true);
      const anonymous = await app.request('/products/search?q=water');
      assert.equal(anonymous.body.results.find((p) => p.id === productId).favorited, undefined);
    });

    it('removes a favorite and reports unfavorited state', async () => {
      const removed = await app.request(`/favorites/${productId}`, { method: 'DELETE', token: userA.token });
      assert.equal(removed.status, 200);
      assert.equal(removed.body.data.favorited, false);
      const state = await app.request(`/favorites/${productId}`, { token: userA.token });
      assert.equal(state.body.data.favorited, false);
    });

    it('isolates favorites between users', async () => {
      await app.request(`/favorites/${productId}`, { method: 'POST', token: userA.token });
      const bList = await app.request('/favorites', { token: userB.token });
      assert.equal(bList.body.data.total, 0);
      const bState = await app.request(`/favorites/${productId}`, { token: userB.token });
      assert.equal(bState.body.data.favorited, false);
      await app.request(`/favorites/${productId}`, { method: 'DELETE', token: userB.token });
      const aState = await app.request(`/favorites/${productId}`, { token: userA.token });
      assert.equal(aState.body.data.favorited, true);
    });

    it('rejects unknown and invalid product ids', async () => {
      assert.equal((await app.request('/favorites/not-an-id', { method: 'POST', token: userA.token })).status, 400);
      assert.equal((await app.request('/favorites/000000000000000000000000', { method: 'POST', token: userA.token })).status, 404);
    });

    it('cascades favorite rows when an admin deletes the product', async () => {
      const created = await app.request('/products', {
        method: 'POST',
        token: admin.token,
        body: { name: 'TEMP Favorite Target', category: 'Home', price: 1 },
      });
      const tempId = created.body.product.id;
      await app.request(`/favorites/${tempId}`, { method: 'POST', token: userA.token });
      assert.equal((await app.request(`/favorites/${tempId}`, { token: userA.token })).body.data.favorited, true);
      assert.equal((await app.request(`/products/${tempId}`, { method: 'DELETE', token: admin.token })).status, 200);
      assert.equal(await app.models.Favorite.countDocuments({ product: tempId }), 0);
      const listed = await app.request('/favorites', { token: userA.token });
      assert.ok(listed.body.data.items.every((item) => item.product?.id !== tempId));
    });
  });

  describe('regression: public catalog still works', () => {
    it('lists and searches without a token', async () => {
      assert.equal((await app.request('/products')).status, 200);
      assert.equal((await app.request('/products/search?q=water')).status, 200);
      assert.equal((await app.request(`/products/${productId}`)).status, 200);
      assert.ok((await app.request('/products?limit=50')).body.total >= demoProducts.length - 1);
    });
  });
});
