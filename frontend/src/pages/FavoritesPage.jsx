import Icon from '../components/Icon.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { useFavoritesList } from '../hooks/useFavorites.js';
import { navigate } from '../hooks/useHashRoute.js';

export default function FavoritesPage() {
  const list = useFavoritesList();
  const products = list.items.map((item) => ({ ...item.product, favorited: true }));

  return (
    <section className="library-page page-width">
      <div className="library-header">
        <p className="eyebrow">SAVED FOR LATER</p>
        <h1>My favorite products</h1>
        <p>Products you have saved. Unfavorite any card to remove it from this list.</p>
      </div>

      {list.status === 'loading' && (
        <p className="results-message results-message--loading" role="status"><span className="spinner" /> Loading favorites…</p>
      )}

      {list.status === 'error' && (
        <div className="results-message results-message--error" role="alert">
          <Icon name="info" size={28} />
          <h3>Could not load favorites</h3>
          <p>{list.error}</p>
          <button type="button" onClick={() => list.reload(1)}><Icon name="refresh" size={16} /> Try again</button>
        </div>
      )}

      {list.status === 'success' && products.length === 0 && (
        <div className="results-message results-message--empty" role="status">
          <Icon name="heart" size={32} />
          <h3>You haven't saved any products yet.</h3>
          <p>Browse the catalog and tap the heart on anything you want to revisit.</p>
          <button type="button" onClick={() => navigate('/')}><Icon name="search" size={16} /> Explore products</button>
        </div>
      )}

      {list.status === 'success' && products.length > 0 && (
        <>
          <p className="library-toolbar"><span>{list.total} favorite{list.total === 1 ? '' : 's'}</span></p>
          <div className="results-grid" aria-label="Favorite products">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onFavoriteChange={(favorited) => { if (!favorited) list.reload(list.page); }}
              />
            ))}
          </div>
          {list.totalPages > 1 && (
            <nav className="pagination" aria-label="Favorites pages">
              <button type="button" disabled={list.page <= 1} onClick={() => list.reload(list.page - 1)}>Previous</button>
              <span>Page {list.page} of {list.totalPages}</span>
              <button type="button" disabled={list.page >= list.totalPages} onClick={() => list.reload(list.page + 1)}>Next</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
