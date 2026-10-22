import Icon from './Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useComparison } from '../context/ComparisonContext.jsx';
import { useHashRoute, navigate } from '../hooks/useHashRoute.js';

/**
 * Mobile-only sticky bottom navigation. On ≤540px the header collapses
 * its secondary links to preserve the compact top bar; this component
 * keeps Favorites / History / Compare / Dashboard one tap away for
 * authenticated users, and Login / Sign up for anonymous ones.
 *
 * Never affects desktop layout (parent CSS is `display:none` above 540px).
 */
export default function MobileNav() {
  const { isAuthenticated, loading } = useAuth();
  const comparison = useComparison();
  const route = useHashRoute();
  const pathname = route.split('?')[0] || '/';
  if (loading) return null;

  const items = isAuthenticated
    ? [
        { path: '/', label: 'Browse', icon: 'search' },
        { path: '/favorites', label: 'Favorites', icon: 'heart' },
        { path: '/history', label: 'History', icon: 'clock' },
        {
          path: '/compare',
          label: 'Compare',
          icon: 'box',
          badge: comparison.count > 0 ? String(comparison.count) : null,
        },
        { path: '/dashboard', label: 'Me', icon: 'leaf' },
      ]
    : [
        { path: '/', label: 'Browse', icon: 'search' },
        { path: '/compare', label: 'Compare', icon: 'box', badge: comparison.count > 0 ? String(comparison.count) : null },
        { path: '/login', label: 'Log in', icon: 'globe' },
        { path: '/register', label: 'Sign up', icon: 'sparkles' },
      ];

  return (
    <nav className="mobile-nav" aria-label="Primary mobile navigation">
      {items.map((item) => {
        const active = (item.path === '/' && pathname === '/') || (item.path !== '/' && pathname.startsWith(item.path));
        return (
          <button
            key={item.path}
            type="button"
            className={active ? 'is-active' : ''}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item.path)}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
