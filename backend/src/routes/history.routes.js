import { Router } from 'express';
import * as controller from '../controllers/history.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateParam } from '../middleware/validateProduct.js';

const router = Router();

router.use(authenticate);
router.get('/', controller.listHistory);
router.delete('/', controller.clearHistory);
router.delete('/:id', validateParam('id', 'history id'), controller.deleteHistoryEntry);

export default router;
