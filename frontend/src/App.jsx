import AppShell from './components/AppShell.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ComparisonProvider } from './context/ComparisonContext.jsx';
import { useHashRoute, parseRoute } from './hooks/useHashRoute.js';
import Home from './pages/Home.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FavoritesPage from './pages/FavoritesPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import ComparePage from './pages/ComparePage.jsx';
import ProductDetailsPage from './pages/ProductDetailsPage.jsx';

function Routes() {
  const route = useHashRoute();
  const { pathname } = parseRoute(route);

  // Public product details: #/products/:id (reuses GET /api/products/:id).
  const productMatch = /^\/products\/([a-zA-Z0-9_-]+)\/?$/.exec(pathname);
  if (productMatch) {
    return (
      <AppShell>
        <ProductDetailsPage productId={productMatch[1]} />
      </AppShell>
    );
  }

  let page;
  switch (pathname) {
    case '/':
      page = <Home />;
      break;
    case '/login':
      page = <AuthPage mode="login" route={route} />;
      break;
    case '/register':
      page = <AuthPage mode="register" route={route} />;
      break;
    case '/dashboard':
      page = (
        <ProtectedRoute route={route}>
          <DashboardPage />
        </ProtectedRoute>
      );
      break;
    case '/favorites':
      page = (
        <ProtectedRoute route={route}>
          <FavoritesPage />
        </ProtectedRoute>
      );
      break;
    case '/history':
      page = (
        <ProtectedRoute route={route}>
          <HistoryPage />
        </ProtectedRoute>
      );
      break;
    case '/compare':
      page = <ComparePage />;
      break;
    default:
      page = <Home />;
  }

  return <AppShell>{page}</AppShell>;
}

export default function App() {
  return (
    <AuthProvider>
      <ComparisonProvider>
        <Routes />
      </ComparisonProvider>
    </AuthProvider>
  );
}
