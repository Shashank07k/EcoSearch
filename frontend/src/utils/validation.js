export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_PATTERN.test(email.trim()) && email.length <= 254;
}

// Mirrors the backend policy: 8+ characters with at least one letter and number.
export function passwordIssues(password) {
  const issues = [];
  if (typeof password !== 'string' || password.length < 8) issues.push('at least 8 characters');
  if (!/[a-zA-Z]/.test(password || '')) issues.push('a letter');
  if (!/\d/.test(password || '')) issues.push('a number');
  if ((password || '').length > 128) issues.push('at most 128 characters');
  return issues;
}

export function validateCredentials({ name, email, password }, { register = false } = {}) {
  const errors = {};
  if (register && (typeof name !== 'string' || name.trim().length < 2)) errors.name = 'Please enter your name.';
  if (!isValidEmail(email)) errors.email = 'Please enter a valid email address.';
  const issues = passwordIssues(password);
  if (register && issues.length) errors.password = `Password needs ${issues.join(', ')}.`;
  else if (register === false && (!password || !password.length)) errors.password = 'Please enter your password.';
  return errors;
}
