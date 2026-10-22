import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { validateRegisterBody, validateLoginBody } from '../middleware/validateAuth.js';

const router = Router();

router.post('/register', authRateLimiter, validateRegisterBody, controller.register);
router.post('/login', authRateLimiter, validateLoginBody, controller.login);
router.get('/me', authenticate, controller.me);

export default router;
