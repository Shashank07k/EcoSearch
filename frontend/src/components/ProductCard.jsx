import { useState } from 'react';
import { formatPrice } from '../utils/format.js';
import { scoreRating } from '../utils/analysis.js';
import { useSustainabilityAnalysis } from '../hooks/useSustainabilityAnalysis.js';
import { useFavoriteToggle } from '../hooks/useFavorites.js';
import { useComparison } from '../context/ComparisonContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { navigate } from '../hooks/useHashRoute.js';
import AnalysisResult from './AnalysisResult.jsx';
import Icon from './Icon.jsx';



export default function ProductCard({ product, onFavoriteChange }) {
  const analysis = useSustainabilityAnalysis(product.id);
  const { isAuthenticated } = useAuth();
  const favorite = useFavoriteToggle(product);
  const comparison = useComparison();
  const isCompared = comparison.isSelected(product.id);
  const canCompareMore = comparison.canAddMore || isCompared;
  const [imageFailed, setImageFailed] = useState(false);
  const data = analysis.data;
  const score = data?.score ?? product.sustainability?.score;
  const rating = scoreRating(score);
  const hasAI = Boolean(data || (product.sustainability?.analyzedAt && product.sustainability?.analysisVersion));
  const isLoading = analysis.status === 'loading';
  const hasError = ['error', 'unavailable', 'invalid'].includes(analysis.status);
  const image = /^https?:\/\//.test(product.imageUrl || '') && !imageFailed;

  return (
    <article className={`product-card${data ? ' product-card--expanded' : ''}`} aria-label={product.name}>
      <a
        className="product-card__visual product-card__visual-link"
        href={`#/products/${product.id}`}
        aria-label={`View details for ${product.name}`}
        onClick={(event) => { event.preventDefault(); navigate(`/products/${product.id}`); }}
      >
        {!image && <div className="product-image-placeholder" aria-hidden="true"><Icon name="leaf" size={58} /></div>}
        {image && <img src={product.imageUrl} alt={product.name} loading="lazy" onError={() => setImageFailed(true)} />}
        <span className="category-tag">{product.category}</span>
      </a>
      <div className="product-card__body">
        <div className="product-card__eyebrow"><span>{product.brand || 'Brand not supplied'}</span><strong>{formatPrice(product.price)}</strong></div>
        <h3 className="product-card__name">
          <a
            className="product-card__link"
            href={`#/products/${product.id}`}
            onClick={(event) => { event.preventDefault(); navigate(`/products/${product.id}`); }}
          >
            {product.name}
          </a>
        </h3>
        <p className="product-card__summary">{data?.summary || product.sustainability?.summary || 'A small choice worth a closer look. Explore its potential environmental considerations.'}</p>
        <div className="product-card__assessment">
          <span><Icon name="leaf" size={14} /> {hasAI ? 'AI estimate' : 'Catalog estimate'}</span>
          {rating.band !== 'unknown' ? <span className={`score-badge score-badge--${rating.band}`} title={hasAI ? 'Estimated AI assessment, not a certified score' : 'Illustrative or manually supplied catalog score; not an AI analysis'}><strong>{score}</strong><span>/100</span></span> : <span className="not-assessed">Not assessed</span>}
        </div>
        <button
          type="button"
          className={`compare-button${isCompared ? ' is-active' : ''}`}
          aria-pressed={isCompared}
          aria-label={isCompared ? 'Remove from comparison' : 'Add to comparison'}
          onClick={() => {
            if (isCompared) comparison.removeProduct(product.id);
            else if (canCompareMore) comparison.addProduct(product);
          }}
          disabled={!isCompared && !canCompareMore}
          title={!isCompared && !canCompareMore ? `Maximum ${comparison.max} products in a comparison` : undefined}
        >
          <Icon name="box" size={16} />
          {isCompared ? 'Compared' : 'Compare'}
        </button>
        <button
          type="button"
          className={`favorite-button${favorite.favorited ? ' is-active' : ''}`}
          aria-pressed={favorite.favorited}
          aria-label={isAuthenticated ? (favorite.favorited ? 'Remove from favorites' : 'Add to favorites') : 'Sign in to save'}
          onClick={async () => {
            if (!isAuthenticated) {
              navigate('/login?next=%23%2F&reason=favorite');
              return;
            }
            const next = await favorite.toggle();
            if (typeof next === 'boolean') onFavoriteChange?.(next);
          }}
          disabled={favorite.busy}
        >
          <Icon name="heart" size={16} filled={favorite.favorited} />
          {isAuthenticated ? (favorite.favorited ? 'Favorited' : 'Add to Favorites') : 'Sign in to save'}
        </button>
        {favorite.error && <p className="favorite-error" role="alert">{favorite.error}</p>}
        <button
          type="button"
          className="analyze-button"
          onClick={() => {
            if (!isAuthenticated) {
              navigate('/login?next=%23%2F&reason=analyze');
              return;
            }
            analysis.analyze();
          }}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? <><span className="spinner" /> Analyzing…</> : (
            <><Icon name={data ? 'refresh' : 'sparkles'} size={17} />
              {isAuthenticated ? (data ? 'Check saved analysis' : 'Analyze Sustainability') : 'Sign in to analyze'}
              <Icon name="arrow" size={16} /></>
          )}
        </button>
        {isLoading && <p className="analysis-loading" role="status">Reviewing this product’s available information…</p>}
        {hasError && <div className="analysis-error" role="alert">
          <strong>{analysis.status === 'unavailable' ? 'AI analysis unavailable' : analysis.status === 'invalid' ? 'Analysis could not be validated' : 'Unable to analyze this product'}</strong>
          <p>{analysis.error}</p>
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                navigate('/login?next=%23%2F&reason=analyze');
                return;
              }
              analysis.analyze();
            }}
          >
            <Icon name="refresh" size={14} /> {isAuthenticated ? 'Try again' : 'Sign in to retry'}
          </button>
        </div>}
        {data && <AnalysisResult data={data} cached={analysis.status === 'cached'} />}
      </div>
    </article>
  );
}
