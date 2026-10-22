import { useEffect, useState } from 'react';
import AuthForm from '../components/AuthForm.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { navigate, parseRoute } from '../hooks/useHashRoute.js';

const NOTICES = {
  analyze: 'Please sign in or create an account to request AI sustainability analysis. The public catalog stays open to everyone.',
  favorite: 'Please sign in to save favorite products. You can keep browsing the catalog without an account.',
  history: 'Please sign in to view your search history.',
};

export default function AuthPage({ mode, route }) {
  const isRegister = mode === 'register';
  const { login, register, isAuthenticated } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const { params } = parseRoute(route);
  const next = params.get('next') || '#/';
  const notice = NOTICES[params.get('reason')] || '';

  // Already signed in? Do not show the form.
  useEffect(() => {
    if (isAuthenticated) navigate(next.startsWith('#') ? next.slice(1) : '/');
  }, [isAuthenticated, next]);

  async function handleSubmit(payload) {
    setSubmitting(true);
    try {
      if (isRegister) await register(payload);
      else await login(payload);
      navigate(next.startsWith('#') ? next.slice(1) : '/');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-aside" aria-hidden="true">
          <span className="brand-mark"><Icon name="leaf" size={26} /></span>
          <h2>{isRegister ? 'Join EcoSearch' : 'Welcome back'}</h2>
          <p>
            {isRegister
              ? 'Create an account to request AI sustainability analyses and keep your better choices in one place.'
              : 'Sign in to request AI sustainability analyses and save your progress.'}
          </p>
          <ul>
            <li><Icon name="leaf" size={16} /> Estimated scores, clearly labeled</li>
            <li><Icon name="sparkles" size={16} /> Backend-protected AI analysis</li>
            <li><Icon name="globe" size={16} /> Public catalog stays open to everyone</li>
          </ul>
        </div>
        <div className="auth-panel">
          <p className="eyebrow">{isRegister ? 'CREATE ACCOUNT' : 'SIGN IN'}</p>
          <h1>{isRegister ? 'Start exploring consciously' : 'Sign in to EcoSearch'}</h1>
          {notice && <p className="auth-notice" role="status"><Icon name="info" size={16} /> {notice}</p>}
          <AuthForm
            mode={mode}
            submitting={submitting}
            onSubmit={handleSubmit}
            onSwitch={() => navigate(isRegister ? '/login' : '/register')}
          />
          <p className="auth-security-note">
            <Icon name="info" size={14} /> This learning project stores access tokens in localStorage.
            Prefer secure, HttpOnly cookies for production.
          </p>
        </div>
      </div>
    </section>
  );
}
