import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useComparison } from '../context/ComparisonContext.jsx';
import { navigate } from '../hooks/useHashRoute.js';
import { getFavorites } from '../services/favoritesService.js';
import { getHistory } from '../services/historyService.js';
import { formatSearchTime, historySearchPath } from '../utils/history.js';

const capabilities = {
  admin: [
    'Browse and search the public product catalog',
    'Request AI sustainability analyses',
    'Save favorites and revisit search history',
    'Compare products with a deterministic recommendation',
    'Create, update and delete catalog products',
  ],
  user: [
    'Browse and search the public product catalog',
    'Request AI sustainability analyses for any product',
    'Save favorite products and revisit search history',
    'Compare 2–4 products side by side with an explainable recommendation',
  ],
};

export default function DashboardPage() {
  const { user, hasRole, logout } = useAuth();
  const comparison = useComparison();
  const role = hasRole('admin') ? 'admin' : 'user';
  const [summary, setSummary] = useState({ status: 'loading', favorites: 0, recent: [] });

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFavorites({ page: 1, limit: 1 }), getHistory({ page: 1, limit: 5 })])
      .then(([favorites, history]) => {
        if (cancelled) return;
        setSummary({
          status: 'success',
          favorites: favorites.data.total,
          recent: history.data.items,
          searches: history.data.total,
        });
      })
      .catch(() => {
        if (!cancelled) setSummary((previous) => ({ ...previous, status: 'error' }));
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="dashboard-page page-width">
      <div className="dashboard-header">
        <p className="eyebrow">YOUR WORKSPACE</p>
        <h1>Hello, {user?.name} 👋</h1>
        <p>You are signed in as <strong>{user?.email}</strong>.</p>
      </div>

      <div className="stats-row">
        <button
          type="button"
          className="stat-block link-stat"
          onClick={() => navigate('/favorites')}
          aria-label={`Open favorites (${summary.favorites})`}
        >
          <span className="stat-icon"><Icon name="heart" size={20} /></span>
          <span className="stat-content">
            <span className="stat-value">{summary.status === 'success' ? summary.favorites : '—'}</span>
            <span className="stat-label">Favorites</span>
          </span>
        </button>
        <button
          type="button"
          className="stat-block link-stat"
          onClick={() => navigate('/history')}
          aria-label={`Open search history (${summary.searches})`}
        >
          <span className="stat-icon"><Icon name="clock" size={20} /></span>
          <span className="stat-content">
            <span className="stat-value">{summary.status === 'success' ? (summary.searches ?? 0) : '—'}</span>
            <span className="stat-label">Searches</span>
          </span>
        </button>
        <button
          type="button"
          className="stat-block link-stat"
          onClick={() => navigate(comparison.count >= 2 ? '/compare' : '/')}
          aria-label={`Open comparison (${comparison.count} selected)`}
        >
          <span className="stat-icon"><Icon name="box" size={20} /></span>
          <span className="stat-content">
            <span className="stat-value">{comparison.count}/{comparison.max}</span>
            <span className="stat-label">Comparing</span>
          </span>
        </button>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <span className="dashboard-icon"><Icon name="leaf" size={22} /></span>
          <h2>Account</h2>
          <dl>
            <div><dt>Name</dt><dd>{user?.name}</dd></div>
            <div><dt>Email</dt><dd>{user?.email}</dd></div>
            <div><dt>Role</dt><dd><span className={`role-badge role-badge--${role}`}>{role}</span></dd></div>
          </dl>
        </article>
        <article className="dashboard-card">
          <span className="dashboard-icon"><Icon name="sparkles" size={22} /></span>
          <h2>What you can do</h2>
          <ul className="capability-list">
            {capabilities[role].map((capability) => (
              <li key={capability}><Icon name="check" size={15} /> {capability}</li>
            ))}
          </ul>
          <p className="dashboard-note">
            AI analyses and recommendations are decision-support estimates based on product listings — not certified environmental scores.
          </p>
        </article>
      </div>

      <article className="dashboard-card dashboard-recent">
        <h2><Icon name="clock" size={18} /> Recent searches</h2>
        {summary.status === 'loading' && <p className="dashboard-note">Loading recent activity…</p>}
        {summary.status === 'error' && <p className="dashboard-note">Could not load recent searches.</p>}
        {summary.status === 'success' && summary.recent.length === 0 && (
          <div className="recent-empty">
            <p>No searches saved yet. Try looking up a product like <em>water</em>, <em>bamboo</em>, or <em>reusable</em>.</p>
            <button type="button" className="primary-action" onClick={() => navigate('/')}>
              <Icon name="search" size={16} /> Browse products
            </button>
          </div>
        )}
        {summary.status === 'success' && summary.recent.length > 0 && (
          <ul className="recent-search-list">
            {summary.recent.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => navigate(historySearchPath(item.query))}>
                  <strong>{item.query}</strong>
                  <span>{item.resultCount} result{item.resultCount === 1 ? '' : 's'} · {formatSearchTime(item.searchedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>

      <div className="dashboard-actions">
        <button type="button" className="primary-action" onClick={() => navigate('/')}>
          <Icon name="search" size={16} /> Explore products
        </button>
        <button type="button" className="secondary-action" onClick={() => navigate('/favorites')}>
          <Icon name="heart" size={16} /> Favorites
        </button>
        <button type="button" className="secondary-action" onClick={() => navigate('/history')}>
          <Icon name="clock" size={16} /> History
        </button>
        <button type="button" className="secondary-action" onClick={() => navigate('/compare')}>
          <Icon name="box" size={16} /> Compare
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={() => { logout(); navigate('/'); }}
        >
          Logout
        </button>
      </div>
    </section>
  );
}
