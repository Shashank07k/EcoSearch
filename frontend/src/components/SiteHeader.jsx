import Icon from './Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useComparison } from '../context/ComparisonContext.jsx';
import { navigate } from '../hooks/useHashRoute.js';

function scrollToId(id) {
  navigate('/');
  // Allow the home page to render before scrolling.
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60);
}

export default function SiteHeader() {
  const { isAuthenticated, user, loading, logout, hasRole } = useAuth();
  const comparison = useComparison();

  return (
    <header className="site-header">
      <div className="header-inner">
        <a
          className="wordmark"
          href="#/"
          aria-label="EcoSearch home"
          onClick={(event) => { event.preventDefault(); navigate('/'); }}
        >
          <span className="brand-mark"><Icon name="leaf" size={24} /></span>
          Eco<span>Search</span><span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#/" onClick={(event) => { event.preventDefault(); scrollToId('catalog'); }}>Explore products</a>
          <a href="#how-it-works" onClick={(event) => { event.preventDefault(); scrollToId('how-it-works'); }}>How it works</a>
          <a
            href="#/compare"
            onClick={(event) => { event.preventDefault(); navigate('/compare'); }}
            aria-current={globalThis.location?.hash === '#/compare' ? 'page' : undefined}
          >
            Compare
            {comparison.count > 0 && <span className="header-badge">{comparison.count}</span>}
          </a>
        </nav>
        <div className="header-auth">
          {loading ? (
            <span className="header-note"><span className="spinner" /> Checking session…</span>
          ) : isAuthenticated ? (
            <>
              <button type="button" className="header-link" onClick={() => navigate('/favorites')}>Favorites</button>
              <button type="button" className="header-link" onClick={() => navigate('/history')}>History</button>
              <button type="button" className="header-link" onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
              <span className="user-chip" title={user.email}>
                <span className="user-avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                <span className="user-meta">
                  <strong>{user.name}</strong>
                  <small>{hasRole('admin') ? 'Administrator' : 'Member'}</small>
                </span>
              </span>
              <button type="button" className="header-logout" onClick={() => { logout(); navigate('/'); }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button type="button" className="header-link" onClick={() => navigate('/login')}>Login</button>
              <button type="button" className="header-signup" onClick={() => navigate('/register')}>
                Create account<Icon name="arrow" size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
