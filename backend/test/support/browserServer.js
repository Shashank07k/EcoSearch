// TEST ONLY. Never imported by src/app.js. Real Express + MongoDB; only AI is mocked.
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from '../../src/config/env.js';
import Product from '../../src/models/Product.js';
import User from '../../src/models/User.js';
import SearchHistory from '../../src/models/SearchHistory.js';
import Favorite from '../../src/models/Favorite.js';
import RecommendationCache from '../../src/models/RecommendationCache.js';
import { createProductRouter } from '../../src/routes/product.routes.js';
import authRouter from '../../src/routes/auth.routes.js';
import healthRouter from '../../src/routes/health.routes.js';
import historyRouter from '../../src/routes/history.routes.js';
import favoriteRouter from '../../src/routes/favorite.routes.js';
import { createSustainabilityService } from '../../src/services/sustainability.service.js';
import { AnalysisError } from '../../src/services/ai/analysisError.js';
import { errorHandler, notFound } from '../../src/middleware/errorHandler.js';
import { hashPassword } from '../../src/utils/password.js';
import { demoProducts } from '../../src/scripts/seedData.js';
import { validAnalysis } from '../fixtures/analysis.js';

if (config.nodeEnv !== 'test' || !/^ecosearch_test_[a-z0-9_]+$/i.test(new URL(config.mongodbUri).pathname.slice(1))) {
  throw new Error('Browser fixture requires NODE_ENV=test and an ecosearch_test_* database');
}
let mode = 'valid';
let customGenerate = null;
let calls = 0;
// Test-only account credentials live exclusively in this fixture/test DB.
const ADMIN_EMAIL = 'admin@ecosearch.test';
const ADMIN_PASSWORD = 'AdminPassword123!';

const connect = () => mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 10_000 });
await connect();
await Promise.all([Product.init(), User.init(), SearchHistory.init(), Favorite.init(), RecommendationCache.init()]);

const provider = {
  async generateAnalysis(args) {
    calls++;
    if (customGenerate) return customGenerate(args);
    if (mode === 'unavailable') throw new AnalysisError('AI_UNAVAILABLE');
    if (mode === 'failure') throw new Error('private test provider failure');
    if (mode === 'invalid') return { ...validAnalysis, score: 101 };
    if (mode === 'markup') return { ...validAnalysis, summary: '<img src=x onerror="window.unsafeAI=true"> This is untrusted output rendered as text.' };
    return structuredClone(validAnalysis);
  },
};
const service = createSustainabilityService({ provider });
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.post('/__test/control', async (req, res) => {
  if (req.body.reset) {
    if (mongoose.connection.readyState !== 1) await connect();
    await Product.deleteMany({});
    await User.deleteMany({});
    await SearchHistory.deleteMany({});
    await Favorite.deleteMany({});
    await RecommendationCache.deleteMany({});
    await Product.insertMany(demoProducts);
    await User.create({
      name: 'Fixture Admin',
      email: ADMIN_EMAIL,
      role: 'admin',
      passwordHash: await hashPassword(ADMIN_PASSWORD),
    });
    calls = 0;
    customGenerate = null;
    mode = 'valid';
  }
  if (Object.hasOwn(req.body, 'mode')) mode = req.body.mode || 'valid';
  if (req.body.generate) customGenerate = req.body.generate;
  if (req.body.databaseOffline) await mongoose.disconnect();
  res.json({ success: true });
});
app.post('/__test/generate', express.json(), (req, res) => {
  const script = req.body?.script;
  if (typeof script === 'string') {
    try { customGenerate = Function('"use strict";return (' + script + ')')(); }
    catch (error) { return res.status(400).json({ success: false, error: error.message }); }
  } else if (script === null) {
    customGenerate = null;
  }
  res.json({ success: true });
});
app.get('/__test/state', (_req, res) => res.json({ calls, mode, admin: { email: ADMIN_EMAIL } }));
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/products', createProductRouter({ analyze: service.analyzeProduct, recommendProvider: provider }));
app.use('/api/history', historyRouter);
app.use('/api/favorites', favoriteRouter);
app.use(notFound, errorHandler);
const server = app.listen(config.port, '127.0.0.1', () => console.log('Browser verification API ready'));
async function stop() {
  server.closeAllConnections();
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
