import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

const router = Router();

/**
 * GET /api/health
 * Reports whether the API is running and whether MongoDB is connected.
 */
router.get('/', getHealth);

export default router;
