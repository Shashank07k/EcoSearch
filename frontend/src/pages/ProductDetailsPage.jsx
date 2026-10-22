import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useProductDetails } from '../hooks/useProductDetails.js';
import { useSustainabilityAnalysis } from '../hooks/useSustainabilityAnalysis.js';
import { useFavoriteToggle } from '../hooks/useFavorites.js';
import { useComparison } from '../context/ComparisonContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { navigate } from '../hooks/useHashRoute.js';
import { formatPrice } from '../utils/format.js';
import { scoreRating } from '../utils/analysis.js';
import { explainSustainability, normaliseAlternatives } from '../utils/sustainabilityExplanation.js';

const IMPACT_LABEL = { positive: 'Positive', neutral: 'Uncertain', negative: 'Needs attention' };
const IMPACT_ICON = { positive: 'check', neutral: 'info', negative: 'info' };

function ScoreCard({ score, isAiEstimate }) {
  const rating = scoreRating(score);
  if (rating.band === 'unknown') {
    return (
      <div className="detail-score detail-score--unknown">
        <p className="detail-score__label">Sustainability overview</p>
        <p className="detail-score__value">Not assessed</p>
        <p className="detail-score__hint">Run an AI sustainability analysis to see an estimated score.</p>
      </div>
    );
  }
  return (
    <div className={`detail-score detail-score--${rating.band}`}>
      <p className="detail-score__label">Sustainability overview</p>
      <p className="detail-score__value">
        <strong>{score}</strong><span>/100</span>
      </p>
      <p className={`detail-score__rating detail-score__rating--${rating.band}`}>
        Rating: <strong>{rating.label}</strong>
      </p>
      <p className="detail-score__hint">
        {isAiEstimate
          ? 'AI-generated estimate based on the available product information. Not a scientific certification.'
          : 'Illustrative catalog estimate. Run an AI analysis for an explained assessment.'}
      </p>
    </div>
  );
}

function FactorList({ items, tone }) {
  return (
    <ul className={`detail-factor-list detail-factor-list--${tone}`}>
      {items.map((factor, index) => (
        <li key={`${factor.name}-${index}`}>
          <span className={`detail-factor__badge impact impact--${factor.impact}`}>
            <Icon name={IMPACT_ICON[factor.impact]} size={13} />
            {IMPACT_LABEL[factor.impact]}
          </span>
          <div>
            <strong>{factor.name}</strong>
            <p>{factor.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ProductDetailsPage({ productId }) {
  const details = useProductDetails(productId);
  const analysis = useSustainabilityAnalysis(productId);
  const { isAuthenticated } = useAuth();
  const comparison = useComparison();
  const [imageFailed, setImageFailed] = useState(false);

  const product = details.product;
  const favorite = useFavoriteToggle(product || undefined);

  if (details.status === 'loading') {
    return (
      <section className="detail-page page-width">
        <p className="results-message results-message--loading" role="status">
          <span className="spinner" /> Loading product…
        </p>
      </section>
    );
  }

  if (details.status !== 'success') {
    return (
      <section className="detail-page page-width">
        <div className="results-message results-message--error" role="alert">
          <Icon name="info" size={28} />
          <h3>{details.status === 'missing' ? 'Product not found' : 'Could not load this product'}</h3>
          <p>{details.error}</p>
          <div className="detail-error-actions">
            {details.status !== 'missing' && (
              <button type="button" onClick={details.reload}><Icon name="refresh" size={16} /> Try again</button>
            )}
            <button type="button" onClick={() => navigate('/')}><Icon name="search" size={16} /> Back to products</button>
          </div>
        </div>
      </section>
    );
  }

  // Prefer a fresh/validated AI analysis; otherwise fall back to stored data.
  const analysisData = analysis.data;
  const storedIsAi = Boolean(product.sustainability?.analyzedAt && product.sustainability?.analysisVersion);
  const score = analysisData?.score ?? product.sustainability?.score;
  const summary = analysisData?.summary || product.sustainability?.summary || '';
  const isAiEstimate = Boolean(analysisData) || storedIsAi;

  const { positives, tradeoffs, coverage, hasFactors } =
    explainSustainability(analysisData?.factors ?? product.sustainability?.factors);
  const alternatives = normaliseAlternatives(analysisData?.alternatives ?? product.ecoAlternatives);
  const missingDimensions = coverage.filter((entry) => !entry.covered);

  const isCompared = comparison.isSelected(product.id);
  const canCompareMore = comparison.canAddMore || isCompared;
  const analysisLoading = analysis.status === 'loading';
  const analysisFailed = ['error', 'unavailable', 'invalid'].includes(analysis.status);
  const showAnalysisCta = !analysisData && !analysisLoading;
  const image = /^https?:\/\//.test(product.imageUrl || '') && !imageFailed;

  return (
    <section className="detail-page page-width" aria-labelledby="product-detail-heading">
      <button type="button" className="detail-back" onClick={() => navigate('/')}>
        <Icon name="arrow" size={15} className="detail-back__icon" /> Back to products
      </button>

      {/* --- Product identity ------------------------------------------- */}
      <div className="detail-hero">
        <div className="detail-hero__media">
          {!image && <div className="product-image-placeholder" aria-hidden="true"><Icon name="leaf" size={54} /></div>}
          {image && (
            <img src={product.imageUrl} alt={`${product.name} product photo`} onError={() => setImageFailed(true)} />
          )}
        </div>
        <div className="detail-hero__body">
          <p className="eyebrow">{product.category}</p>
          <h1 id="product-detail-heading">{product.name}</h1>
          <p className="detail-hero__meta">
            <span>{product.brand || 'Brand not supplied'}</span>
            <span aria-hidden="true">·</span>
            <strong>{formatPrice(product.price)}</strong>
          </p>
          {product.description && <p className="detail-hero__description">{product.description}</p>}

          <div className="detail-actions">
            <button
              type="button"
              className={`favorite-button${favorite.favorited ? ' is-active' : ''}`}
              aria-pressed={favorite.favorited}
              aria-label={isAuthenticated ? (favorite.favorited ? 'Remove from favorites' : 'Add to favorites') : 'Sign in to save'}
              disabled={favorite.busy}
              onClick={() => {
                if (!isAuthenticated) {
                  navigate(`/login?next=%23%2Fproducts%2F${product.id}&reason=favorite`);
                  return;
                }
                favorite.toggle();
              }}
            >
              <Icon name="heart" size={16} filled={favorite.favorited} />
              {isAuthenticated ? (favorite.favorited ? 'Favorited' : 'Add to Favorites') : 'Sign in to save'}
            </button>
            <button
              type="button"
              className={`compare-button${isCompared ? ' is-active' : ''}`}
              aria-pressed={isCompared}
              aria-label={isCompared ? 'Remove from comparison' : 'Add to comparison'}
              disabled={!isCompared && !canCompareMore}
              title={!isCompared && !canCompareMore ? `Maximum ${comparison.max} products in a comparison` : undefined}
              onClick={() => {
                if (isCompared) comparison.removeProduct(product.id);
                else if (canCompareMore) comparison.addProduct(product);
              }}
            >
              <Icon name="box" size={16} />
              {isCompared ? 'Compared' : 'Add to comparison'}
            </button>
          </div>
          {favorite.error && <p className="favorite-error" role="alert">{favorite.error}</p>}
        </div>
      </div>

      {/* --- Score + AI state -------------------------------------------- */}
      <div className="detail-assessment">
        <ScoreCard score={score} isAiEstimate={isAiEstimate} />
        <div className="detail-assessment__body">
          <h2><Icon name="sparkles" size={18} /> AI sustainability analysis</h2>
          {summary
            ? <p className="detail-summary">{summary}</p>
            : <p className="detail-summary detail-summary--empty">No sustainability summary is available for this product yet.</p>}

          {analysisLoading && (
            <p className="analysis-loading" role="status"><span className="spinner" /> Analyzing sustainability…</p>
          )}

          {showAnalysisCta && (
            <button
              type="button"
              className="analyze-button"
              onClick={() => {
                if (!isAuthenticated) {
                  navigate(`/login?next=%23%2Fproducts%2F${product.id}&reason=analyze`);
                  return;
                }
                analysis.analyze();
              }}
            >
              <Icon name="sparkles" size={17} />
              {isAuthenticated ? 'Get AI sustainability analysis' : 'Sign in to analyze'}
              <Icon name="arrow" size={16} />
            </button>
          )}

          {analysisData && (
            <p className="analysis-source" role="status">
              <Icon name="check" size={13} /> {analysis.status === 'cached' ? 'Saved analysis' : 'New analysis'}
            </p>
          )}

          {analysisFailed && (
            <div className="analysis-error" role="alert">
              <strong>
                {analysis.status === 'unavailable'
                  ? 'Sustainability analysis is temporarily unavailable.'
                  : analysis.status === 'invalid'
                    ? 'Analysis could not be validated'
                    : 'Unable to analyze this product'}
              </strong>
              <p>{analysis.error}</p>
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate(`/login?next=%23%2Fproducts%2F${product.id}&reason=analyze`);
                    return;
                  }
                  analysis.analyze();
                }}
              >
                <Icon name="refresh" size={14} /> {isAuthenticated ? 'Try again' : 'Sign in to retry'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- Why eco-friendly / trade-offs -------------------------------- */}
      <div className="detail-reasons">
        <section className="detail-reasons__column detail-reasons__column--positive" aria-labelledby="detail-positive-heading">
          <h2 id="detail-positive-heading"><Icon name="leaf" size={17} /> Why this product may be a better choice</h2>
          {positives.length > 0
            ? <FactorList items={positives} tone="positive" />
            : (
              <p className="analysis-empty">
                {hasFactors
                  ? 'No clearly positive environmental factors were identified from the available information.'
                  : 'Information not available. Run an AI sustainability analysis to see an explanation.'}
              </p>
            )}
        </section>

        <section className="detail-reasons__column detail-reasons__column--tradeoff" aria-labelledby="detail-tradeoff-heading">
          <h2 id="detail-tradeoff-heading"><Icon name="info" size={17} /> What to keep in mind</h2>
          {tradeoffs.length > 0
            ? <FactorList items={tradeoffs} tone="tradeoff" />
            : (
              <p className="analysis-empty">
                {hasFactors
                  ? 'No specific trade-offs were identified, which does not mean there are none.'
                  : 'Information not available.'}
              </p>
            )}
          {missingDimensions.length > 0 && (
            <div className="detail-missing">
              <h3>Information not available</h3>
              <ul>
                {missingDimensions.map((entry) => (
                  <li key={entry.dimension}><Icon name="info" size={12} /> {entry.dimension}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* --- Full factor table -------------------------------------------- */}
      <section className="detail-factors" aria-labelledby="detail-factors-heading">
        <h2 id="detail-factors-heading">Environmental factors</h2>
        {hasFactors ? (
          <FactorList items={[...positives, ...tradeoffs]} tone="all" />
        ) : (
          <p className="analysis-empty">No structured environmental factors are available for this product yet.</p>
        )}
      </section>

      {/* --- Alternatives -------------------------------------------------- */}
      <section className="detail-alternatives" aria-labelledby="detail-alternatives-heading">
        <h2 id="detail-alternatives-heading">Other options to consider</h2>
        {alternatives.length > 0 ? (
          <ul className="detail-alternative-list">
            {alternatives.map((alternative, index) => (
              <li key={`${alternative.name}-${index}`}>
                <Icon name="leaf" size={16} />
                <div>
                  <strong>{alternative.name}</strong>
                  <p>{alternative.reason}</p>
                  {alternative.productId ? (
                    <button type="button" className="text-action" onClick={() => navigate(`/products/${alternative.productId}`)}>
                      View this product <Icon name="arrow" size={13} />
                    </button>
                  ) : (
                    <span className="detail-alternative__hint">Suggested product type, not a catalog listing</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="analysis-empty">No alternatives were suggested from the available information.</p>
        )}
      </section>

      <p className="analysis-disclaimer detail-disclaimer">
        <Icon name="info" size={15} />
        <span>
          <strong>About this assessment.</strong> Scores and explanations are AI-generated estimates based only on the
          information in this listing. They are not a scientific certification, and “eco-friendly” is never absolute —
          sustainability involves trade-offs. Verify important claims independently.
        </span>
      </p>
    </section>
  );
}
