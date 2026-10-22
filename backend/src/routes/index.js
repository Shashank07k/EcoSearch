import { Router } from 'express';
import healthRoutes from './health.routes.js';
import productRoutes from './product.routes.js';
import authRoutes from './auth.routes.js';
import historyRoutes from './history.routes.js';
import favoriteRoutes from './favorite.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/history', historyRoutes);
router.use('/favorites', favoriteRoutes);

export default router;
