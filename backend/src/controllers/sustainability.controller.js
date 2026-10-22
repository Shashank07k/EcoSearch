import { analyzeProduct } from '../services/sustainability.service.js';

/** Express 5 forwards rejected promises to the existing centralized handler. */
export const createAnalyzeController = (analyze = analyzeProduct) => async (req, res) => {
  const result = await analyze(req.params.id);
  res.set('Cache-Control', 'no-store').json({ success: true, ...result });
};
