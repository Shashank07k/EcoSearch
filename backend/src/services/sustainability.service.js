import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { assertDatabaseReady } from './product.service.js';
import { badRequest, notFoundError, serviceUnavailable } from '../utils/httpError.js';
import { getAIProvider } from './ai/aiProvider.js';
import { AnalysisError } from './ai/analysisError.js';
import { analysisSchema, validateAnalysis } from './ai/analysis.schema.js';
import { buildSustainabilityPrompt } from './ai/sustainability.prompt.js';
import { ANALYSIS_VERSION, analysisInputHash, cachedAnalysis } from './ai/analysis.cache.js';

/**
 * Provider injection is the test seam. Production always uses the HTTP provider.
 * MongoDB remains the persistent source of truth, not this in-flight map.
 */
export function createSustainabilityService({
  provider = getAIProvider(),
  ProductModel = Product,
  checkDatabase = assertDatabaseReady,
  now = () => new Date(),
} = {}) {
  const inFlight = new Map();

  async function loadProduct(id) {
    try {
      return await ProductModel.findById(id).select('+sustainability.analysisInputHash').lean();
    } catch {
      throw serviceUnavailable('The product database is temporarily unavailable. Please try again.');
    }
  }

  async function generateAndSave(product) {
    let output;
    try {
      output = await provider.generateAnalysis({
        messages: buildSustainabilityPrompt(product),
        schema: analysisSchema,
      });
    } catch (error) {
      if (error instanceof AnalysisError) throw error;
      if (['AbortError', 'TimeoutError'].includes(error?.name)) throw new AnalysisError('AI_TIMEOUT');
      throw new AnalysisError('AI_PROVIDER_ERROR');
    }
    const data = validateAnalysis(output);
    const { score, summary, factors, alternatives } = data;
    // Compare-and-set on the existing MongoDB version key. Catalog updates also
    // increment __v, preventing a slow AI response from overwriting a newer edit.
    const version = product.__v === undefined ? { $exists: false } : product.__v;
    let saved;
    try {
      saved = await ProductModel.findOneAndUpdate(
        { _id: product._id, __v: version },
        {
          $set: {
            sustainability: {
              score, summary, factors,
              analyzedAt: now(),
              analysisVersion: ANALYSIS_VERSION,
              analysisInputHash: analysisInputHash(product),
            },
            ecoAlternatives: alternatives,
          },
          $inc: { __v: 1 },
        },
        { new: true, runValidators: true },
      ).lean();
    } catch {
      throw new AnalysisError('ANALYSIS_SAVE_FAILED');
    }
    if (!saved) {
      if (!await loadProduct(product._id)) throw notFoundError('Product not found');
      throw new AnalysisError('PRODUCT_CHANGED');
    }
    return { cached: false, data };
  }

  async function analyzeProduct(id) {
    if (!mongoose.isObjectIdOrHexString(id)) throw badRequest('Invalid product id');
    checkDatabase();
    const product = await loadProduct(id);
    if (!product) throw notFoundError('Product not found');
    const cached = cachedAnalysis(product);
    if (cached) return { cached: true, data: cached };

    const key = `${product._id}:${product.__v}:${analysisInputHash(product)}`;
    if (inFlight.has(key)) return inFlight.get(key);
    // Modest process-local cost guard; deploy an edge rate limiter before public use.
    if (inFlight.size >= 8) throw new AnalysisError('AI_UNAVAILABLE');
    const task = generateAndSave(product);
    inFlight.set(key, task);
    try { return await task; }
    finally { inFlight.delete(key); }
  }

  return { analyzeProduct };
}

export const { analyzeProduct } = createSustainabilityService();
