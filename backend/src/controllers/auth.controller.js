import * as authService from '../services/auth.service.js';

/** POST /api/auth/register — role is always assigned server-side as 'user'. */
export async function register(req, res) {
  const result = await authService.registerUser(req.authBody);
  res.status(201).json({ success: true, data: result });
}

/** POST /api/auth/login — generic error for unknown email or wrong password. */
export async function login(req, res) {
  const result = await authService.loginUser(req.authBody);
  res.json({ success: true, data: result });
}

/** GET /api/auth/me — requires `authenticate`. */
export function me(req, res) {
  res.json({ success: true, data: { user: req.user } });
}
