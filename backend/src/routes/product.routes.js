import { Router } from 'express';
import * as controller from '../controllers/product.controller.js';
import * as comparisonController from '../controllers/comparison.controller.js';
import { createAnalyzeController } from '../controllers/sustainability.controller.js';
import { validateProductBody, validateObjectId } from '../middleware/validateProduct.js';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth.js';

// Optional overrides are dependency injection for tests only.
// Production mounts this module's default router with the real provider.
export function createProductRouter({ analyze, recommendProvider } = {}) {
  const router = Router();

  // NOTE: fixed literal routes must be registered before /:id so they are not
  // treated as an id. Public catalog browsing/search/detail remain available
  // without a token.
  router.get('/search', optionalAuthenticate, controller.searchProducts);
  router.get('/compare', optionalAuthenticate, comparisonController.compare);
  router.post('/recommend', optionalAuthenticate, comparisonController.createRecommendController(recommendProvider));
  router.get('/', optionalAuthenticate, controller.listProducts);
  router.get('/:id', optionalAuthenticate, validateObjectId, controller.getProduct);

  // AI analysis is authenticated: it can incur external provider costs.
  router.post(
    '/:id/analyze',
    authenticate,
    validateObjectId,
    createAnalyzeController(analyze),
  );

  // Catalog management is restricted to administrators.
  router.post('/', authenticate, requireRole('admin'), validateProductBody(), controller.createProduct);
  router.put(
    '/:id',
    authenticate,
    requireRole('admin'),
    validateObjectId,
    validateProductBody({ partial: true }),
    controller.updateProduct,
  );
  router.delete('/:id', authenticate, requireRole('admin'), validateObjectId, controller.deleteProduct);

  return router;
}

export default createProductRouter();
