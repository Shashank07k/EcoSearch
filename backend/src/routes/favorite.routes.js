import { Router } from 'express';
import * as controller from '../controllers/favorite.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateParam } from '../middleware/validateProduct.js';

const router = Router();
const validateProductId = validateParam('productId', 'product id');

router.use(authenticate);
router.get('/', controller.listFavorites);
router.get('/:productId', validateProductId, controller.getFavoriteState);
router.post('/:productId', validateProductId, controller.addFavorite);
router.delete('/:productId', validateProductId, controller.removeFavorite);

export default router;
