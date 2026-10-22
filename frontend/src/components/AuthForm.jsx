import { useState } from 'react';
import Icon from './Icon.jsx';
import { ApiError } from '../services/apiClient.js';
import { validateCredentials } from '../utils/validation.js';

export default function AuthForm({ mode, onSubmit, onSwitch, submitting }) {
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [serverDetails, setServerDetails] = useState([]);

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setServerError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validation = validateCredentials(form, { register: isRegister });
    setErrors(validation);
    if (Object.keys(validation).length) return;
    try {
      setServerError('');
      setServerDetails([]);
      const payload = isRegister
        ? { name: form.name.trim(), email: form.email.trim(), password: form.password }
        : { email: form.email.trim(), password: form.password };
      await onSubmit(payload);
    } catch (error) {
      if (error instanceof ApiError) {
        // Prefer backend messages; add a friendly rate-limit fallback.
        const message = error.status === 429
          ? (error.message || 'Too many authentication attempts. Please wait a few minutes and try again.')
          : error.message;
        setServerError(message);
        setServerDetails(Array.isArray(error.details) ? error.details : []);
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {isRegister && (
        <label className="auth-field">
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            autoComplete="name"
            placeholder="Your name"
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <small className="field-error">{errors.name}</small>}
        </label>
      )}
      <label className="auth-field">
        <span>Email</span>
        <input
          type="email"
          value={form.email}
          onChange={(event) => update('email', event.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(errors.email)}
        />
        {errors.email && <small className="field-error">{errors.email}</small>}
      </label>
      <label className="auth-field">
        <span>Password</span>
        <input
          type="password"
          value={form.password}
          onChange={(event) => update('password', event.target.value)}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          placeholder="At least 8 characters"
          aria-invalid={Boolean(errors.password)}
        />
        {errors.password && <small className="field-error">{errors.password}</small>}
      </label>

      {serverError && (
        <div className="auth-server-error" role="alert">
          <Icon name="info" size={17} />
          <div>
            <p>{serverError}</p>
            {serverDetails.length > 0 && (
              <ul>{serverDetails.map((detail) => <li key={detail}>{detail}</li>)}</ul>
            )}
          </div>
        </div>
      )}

      <button className="auth-submit" type="submit" disabled={submitting}>
        {submitting ? (
          <><span className="spinner" /> {isRegister ? 'Creating account…' : 'Signing in…'}</>
        ) : (
          <>{isRegister ? 'Create account' : 'Sign in'}<Icon name="arrow" size={16} /></>
        )}
      </button>
      <p className="auth-switch">
        {isRegister ? 'Already have an account?' : 'New to EcoSearch?'}{' '}
        <button type="button" onClick={onSwitch}>
          {isRegister ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </form>
  );
}
