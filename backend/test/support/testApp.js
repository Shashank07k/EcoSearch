import express from 'express';
import mongoose from 'mongoose';
import Product from '../../src/models/Product.js';
import User from '../../src/models/User.js';
import SearchHistory from '../../src/models/SearchHistory.js';
import Favorite from '../../src/models/Favorite.js';
import { createProductRouter } from '../../src/routes/product.routes.js';
import authRouter from '../../src/routes/auth.routes.js';
import healthRouter from '../../src/routes/health.routes.js';
import historyRouter from '../../src/routes/history.routes.js';
import favoriteRouter from '../../src/routes/favorite.routes.js';
import { errorHandler, notFound } from '../../src/middleware/errorHandler.js';
import { createSustainabilityService } from '../../src/services/sustainability.service.js';
import { AnalysisError } from '../../src/services/ai/analysisError.js';
import { hashPassword } from '../../src/utils/password.js';
import { demoProducts } from '../../src/scripts/seedData.js';
import { validAnalysis } from '../fixtures/analysis.js';

let sequence = 0;
const uniqueEmail = (prefix = 'user') =>
  `${prefix}.${Date.now()}.${(sequence += 1)}@example.com`;

/**
 * Boots the REAL Express/Mongoose application against a dedicated test
 * database. Only the external AI provider is replaced; all HTTP middleware,
 * validation, auth, JWT, caching and persistence code is production code.
 */
export async function createHarness({ seed = false } = {}) {
  const uri = process.env.TEST_MONGODB_URI;
  if (!uri) throw new Error('TEST_MONGODB_URI is required for integration tests');
  const dbName = new URL(uri).pathname.slice(1);
  if (!/^ecosearch_test_[a-z0-9_]+$/i.test(dbName)) {
    throw new Error('TEST_MONGODB_URI must select an ecosearch_test_* database');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  await Promise.all([Product.init(), User.init(), SearchHistory.init(), Favorite.init()]);

  let mode = 'valid';
  let customGenerate = null;
  let aiCalls = 0;
  const provider = {
    async generateAnalysis(args) {
      aiCalls += 1;
      if (customGenerate) return customGenerate(args);
      if (mode === 'unavailable') throw new AnalysisError('AI_UNAVAILABLE');
      if (mode === 'failure') throw new Error('private test provider failure');
      if (mode === 'invalid') return { ...validAnalysis, score: 101 };
      if (mode === 'expired-token') return { ...validAnalysis, score: 50 };
      return structuredClone(validAnalysis);
    },
  };
  const sustainability = createSustainabilityService({ provider });

  const app = express();
  app.use(express.json());
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/products', createProductRouter({ analyze: sustainability.analyzeProduct, recommendProvider: provider }));
  app.use('/api/history', historyRouter);
  app.use('/api/favorites', favoriteRouter);
  app.use(notFound, errorHandler);

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function reset() {
    await Product.deleteMany({});
    await User.deleteMany({});
    await SearchHistory.deleteMany({});
    await Favorite.deleteMany({});
    mode = 'valid';
    customGenerate = null;
    aiCalls = 0;
    if (seed) await Product.insertMany(demoProducts);
  }
  await reset();

  async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await response.json(); } catch { /* non-JSON */ }
    return { status: response.status, body: json, headers: response.headers };
  }

  async function register(overrides = {}) {
    const password = overrides.password || 'StrongPassword123!';
    const response = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Test User', email: uniqueEmail(), password, ...overrides },
    });
    return response;
  }

  const login = (email, password = 'StrongPassword123!') =>
    request('/auth/login', { method: 'POST', body: { email, password } });

  async function createAdmin(overrides = {}) {
    const email = overrides.email || uniqueEmail('admin');
    const password = overrides.password || 'AdminPassword123!';
    const user = await User.create({
      name: overrides.name || 'Test Admin',
      email,
      role: 'admin',
      passwordHash: await hashPassword(password),
    });
    const response = await login(email, password);
    return { user, response, token: response.body.data.token, email, password };
  }

  async function close() {
    if (mongoose.connection.readyState === 1) {
      await Product.deleteMany({});
      await User.deleteMany({});
      await SearchHistory.deleteMany({});
      await Favorite.deleteMany({});
    }
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }

  return {
    base,
    request,
    register,
    login,
    createAdmin,
    reset,
    seedProducts: () => Product.insertMany(demoProducts),
    setAIMode: (next) => { mode = next; },
    setAIGenerate: (fn) => { customGenerate = fn; },
    aiCalls: () => aiCalls,
    models: { Product, User, SearchHistory, Favorite },
    close,
    uniqueEmail,
  };
}
