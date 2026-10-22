import ProductCard from './ProductCard.jsx';
import Icon from './Icon.jsx';

export default function ProductResults({ status, query, results, error, onRetry }) {
  if (status === 'idle' || status === 'loading') {
    return <div aria-busy="true">
      <p className="results-message results-message--loading" role="status"><span className="spinner" /> {query ? `Searching for “${query}”…` : 'Loading the product catalog…'}</p>
      <div className="results-grid" aria-hidden="true">{[0, 1, 2].map((i) => <div className="product-skeleton" key={i}><div /><span /><span /><span /></div>)}</div>
    </div>;
  }
  if (status === 'error') {
    return <div className="results-message results-message--error" role="alert"><Icon name="info" size={28} /><h3>The catalog is taking a breather</h3><p>{error}</p>{onRetry && <button type="button" onClick={onRetry}><Icon name="refresh" size={16} /> Try again</button>}</div>;
  }
  if (!results.length) {
    return <div className="results-message results-message--empty" role="status"><Icon name="search" size={32} /><h3>No products found{query ? ` for “${query}”` : ''}</h3><p>{query ? 'Try another product, brand, or category. A broader search can help.' : 'The catalog is empty. Add products through the API or run the development seed command.'}</p></div>;
  }
  return <div className="results-grid" aria-label="Product results">{results.map((product) => <ProductCard key={`${product.id}:${product.updatedAt || ''}`} product={product} />)}</div>;
}
