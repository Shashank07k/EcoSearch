import { badRequest } from '../utils/httpError.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const NAME_MIN = 2;
const NAME_MAX = 80;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateRegistration(body) {
  if (!isPlainObject(body)) return ['Request body must be a JSON object'];
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const { password } = body;

  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    errors.push(`name must be ${NAME_MIN}–${NAME_MAX} characters`);
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    errors.push('a valid email is required');
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    errors.push(`password must be at least ${PASSWORD_MIN} characters`);
  } else if (password.length > PASSWORD_MAX) {
    errors.push(`password must be at most ${PASSWORD_MAX} characters`);
  } else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    errors.push('password must contain at least one letter and one number');
  }
  return errors;
}

export function validateLogin(body) {
  if (!isPlainObject(body)) return ['Request body must be a JSON object'];
  const errors = [];
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_PATTERN.test(email)) errors.push('a valid email is required');
  if (typeof body.password !== 'string' || body.password.length === 0) {
    errors.push('password is required');
  }
  return errors;
}

const validate = (validator) => (req, _res, next) => {
  const errors = validator(req.body);
  if (errors.length > 0) return next(badRequest('Invalid authentication data', errors));
  // Explicitly ignore any client-supplied role: registration cannot escalate.
  const { name, email, password } = req.body;
  req.authBody = {
    name: typeof name === 'string' ? name.trim() : undefined,
    email: typeof email === 'string' ? email.trim().toLowerCase() : undefined,
    password,
  };
  next();
};

export const validateRegisterBody = validate(validateRegistration);
export const validateLoginBody = validate(validateLogin);
