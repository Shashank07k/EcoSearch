import Icon from '../components/Icon.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { useComparison } from '../context/ComparisonContext.jsx';
import { useComparisonData } from '../hooks/useComparisonData.js';
import { scoreRating } from '../utils/analysis.js';
import { formatPrice } from '../utils/format.js';

function factorImpact(product, name) {
  const factor = product.sustainability?.factors?.find((f) => f.name.toLowerCase() === name.toLowerCase());
  return factor || null;
}

const FACTOR_ROWS = ['Reusability', 'Durability', 'Materials', 'Packaging', 'Repairability', 'End of life'];

function RecommendationCard({ recommendation, products }) {
  if (!recommendation) return null;
  const winner = products.find((p) => p.id === recommendation.recommendedProductId);
  const label = {
    best_sustainability: 'Best sustainability choice',
    better_value: 'Best value choice',
    tied: 'Reasonable choices — tied',
    no_data: 'No sustainability data available',
  }[recommendation.recommendationType] || 'Recommendation';

  return (
    <section className="recommendation-card" aria-label="Recommendation">
      <p className="eyebrow">DECISION SUPPORT · NOT A CERTIFICATION</p>
      <h3>{label}{winner ? `: ${winner.name}` : ''}</h3>
      <p className="recommendation-explanation">{recommendation.explanation}</p>
      {recommendation.aiExplanation?.explanation && (
        <div className="recommendation-ai">
          <span className="ai-pill"><Icon name="sparkles" size={14} /> AI explanation{recommendation.aiExplanation.cached ? ' (cached)' : ''}</span>
          <p>{recommendation.aiExplanation.explanation}</p>
        </div>
      )}
      {recommendation.reasonCodes?.length > 0 && (
        <ul className="reason-list">
          {recommendation.reasonCodes.map((code) => <li key={code}>{code.replace(/_/g, ' ')}</li>)}
        </ul>
      )}
      {recommendation.tradeoffs?.length > 0 && (
        <div className="tradeoffs">
          <h4>Trade-offs</h4>
          <ul>
            {recommendation.tradeoffs.map((item, index) => (
              <li key={`${item.productName}-${index}`}>
                <strong>{item.productName}:</strong> {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ComparisonGrid({ products }) {
  return (
    <div className="comparison-grid" role="table" aria-label="Product comparison">
      <div className="comparison-column comparison-column--label" role="row">
        <div role="columnheader">Detail</div>
        {[...FACTOR_ROWS].map((row) => <div key={row} role="row">{row}</div>)}
      </div>
      {products.map((product) => {
        const rating = scoreRating(product.sustainability?.score);
        return (
          <div className="comparison-column" key={product.id} role="row">
            <div role="columnheader">
              <strong>{product.name}</strong>
              <span>{product.brand || '—'}</span>
            </div>
            <div role="cell">{formatPrice(product.price)}</div>
            <div role="cell">{typeof product.sustainability?.score === 'number' ? `${product.sustainability.score}/100` : '—'}</div>
            <div role="cell">{rating.band !== 'unknown' ? rating.label : '—'}</div>
            <div role="cell">{product.sustainability?.summary || '—'}</div>
            {FACTOR_ROWS.slice(4).map((row) => {
              const factor = factorImpact(product, row);
              return (
                <div key={row} role="cell">
                  {factor ? (
                    <span className={`impact impact--${factor.impact}`}>
                      {factor.impact}
                    </span>
                  ) : '—'}
                  {factor?.description && <small>{factor.description}</small>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function ComparePage() {
  const { selectedProducts, removeProduct, clearProducts } = useComparison();
  const productIds = selectedProducts.map((p) => p.id);
  const data = useComparisonData(productIds);

  return (
    <section className="library-page page-width">
      <div className="library-header">
        <p className="eyebrow">SIDE BY SIDE</p>
        <h1>Compare products</h1>
        <p>Deterministic recommendation + optional AI explanation. Scores are estimates, not certifications.</p>
      </div>

      {selectedProducts.length < 2 && (
        <div className="results-message results-message--empty" role="status">
          <Icon name="search" size={32} />
          <h3>Select at least 2 products</h3>
          <p>Use the "Compare" toggle on any product card, then return here. Up to {4} products at a time.</p>
        </div>
      )}

      {selectedProducts.length >= 2 && (
        <div className="comparison-selection">
          {selectedProducts.map((item) => (
            <span className="compare-chip" key={item.id}>
              {item.name}
              <button type="button" aria-label={`Remove ${item.name} from comparison`} onClick={() => removeProduct(item.id)}>
                <Icon name="close" size={14} />
              </button>
            </span>
          ))}
          <button type="button" className="text-action" onClick={clearProducts}>Clear</button>
        </div>
      )}

      {data.status === 'loading' && <p className="results-message results-message--loading" role="status"><span className="spinner" /> Loading comparison…</p>}

      {data.status === 'error' && (
        <div className="results-message results-message--error" role="alert">
          <Icon name="info" size={28} />
          <h3>Could not load this comparison</h3>
          <p>{data.error}</p>
          <button type="button" onClick={data.reload}><Icon name="refresh" size={16} /> Try again</button>
        </div>
      )}

      {data.status === 'success' && (
        <>
          <RecommendationCard recommendation={data.recommendation} products={data.products} />
          <ComparisonGrid products={data.products} />
          <h3>Save any of these for later</h3>
          <div className="results-grid">
            {data.products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </>
      )}
    </section>
  );
}
