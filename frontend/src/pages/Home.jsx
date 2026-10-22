import { useState } from 'react';
import SearchBar from '../components/SearchBar.jsx';
import ProductResults from '../components/ProductResults.jsx';
import CompareBar from '../components/CompareBar.jsx';
import Icon from '../components/Icon.jsx';
import { useProductSearch } from '../hooks/useProductSearch.js';
import { useHashRoute, parseRoute } from '../hooks/useHashRoute.js';

const categories = ['All products', 'Home', 'Clothing', 'Personal Care', 'Electronics', 'Food', 'Transportation'];

export default function Home() {
  const route = useHashRoute();
  const initialQuery = parseRoute(route).params.get('q') || '';
  const catalog = useProductSearch(initialQuery);
  const [draft, setDraft] = useState(initialQuery);
  const preset = (value) => { setDraft(value); value ? catalog.search(value) : catalog.browse(); };

  return (
    <>
      <section className="hero-section">
        <div className="hero-orbit" aria-hidden="true"><Icon name="leaf" size={30} /></div>
        <div className="hero-kicker"><span className="live-dot" /> Mindful choices. Meaningful change.</div>
        <h1>Small choices.<br /><span>A healthier planet.</span></h1>
        <p className="hero-description">Discover everyday products with a little more perspective.<br className="desktop-break" /> Explore their impact, understand the trade-offs, and find a better fit.</p>
        <SearchBar value={draft} onChange={setDraft} onSearch={catalog.search} onClear={() => preset('')} isLoading={catalog.status === 'loading'} />
        <div className="search-suggestions"><span>A little inspiration:</span>{['Water bottle', 'Bamboo', 'Reusable'].map((term) => <button type="button" key={term} onClick={() => preset(term)}>{term}<Icon name="arrow" size={12} /></button>)}</div>
        <div className="hero-trust"><span><Icon name="box" size={15} /> Real products</span><i /><span><Icon name="sparkles" size={15} /> Thoughtful AI insights</span><i /><span><Icon name="leaf" size={15} /> Better-informed choices</span></div>
      </section>
      <CompareBar />

      <section className="catalog-section page-width" id="catalog" aria-label="Product catalog">
        <div className="catalog-heading"><div><p className="eyebrow">THE EVERYDAY, RECONSIDERED</p><h2>{catalog.query ? 'Your thoughtful finds' : 'Find your next better choice'}</h2></div><div className="catalog-caption"><span className="small-leaf"><Icon name="leaf" size={16} /></span>Good things start with curiosity.</div></div>
        <div className="catalog-toolbar"><div className="category-filters" aria-label="Browse product categories">{categories.map((category, index) => {
          const selected = index === 0 ? !catalog.query : catalog.query.toLowerCase() === category.toLowerCase();
          return <button type="button" key={category} className={selected ? 'category-filter is-active' : 'category-filter'} aria-pressed={selected} onClick={() => preset(index === 0 ? '' : category)}>{category}</button>;
        })}</div></div>
        <div className="results-meta" aria-live="polite"><span>{catalog.status === 'success' ? (catalog.query ? `${catalog.results.length} result${catalog.results.length === 1 ? '' : 's'} for “${catalog.query}”` : `Showing ${catalog.total ? (catalog.page - 1) * 9 + 1 : 0}–${Math.min(catalog.page * 9, catalog.total)} of ${catalog.total} products`) : catalog.status === 'error' ? 'Let’s try that again' : 'Finding thoughtful products…'}</span><span className="estimate-note"><Icon name="info" size={14} /> Scores are estimates, not certifications</span></div>
        <ProductResults {...catalog} onRetry={catalog.retry} />
        {catalog.status === 'success' && !catalog.query && catalog.totalPages > 1 && <nav className="pagination" aria-label="Catalog pages"><button type="button" disabled={catalog.page <= 1} onClick={() => catalog.browse(catalog.page - 1)}>Previous</button><span>Page {catalog.page} of {catalog.totalPages}</span><button type="button" disabled={catalog.page >= catalog.totalPages} onClick={() => catalog.browse(catalog.page + 1)}>Next<Icon name="arrow" size={15} /></button></nav>}
      </section>

      <section className="approach-section page-width" id="how-it-works" aria-labelledby="approach-heading"><div className="approach-intro"><span className="approach-icon"><Icon name="sparkles" size={24} /></span><div><p className="eyebrow">A LITTLE CONTEXT GOES A LONG WAY</p><h2 id="approach-heading">More understanding. Less guesswork.</h2></div></div><div className="approach-grid">
        <div><span className="step-number">01</span><h3>Find something everyday</h3><p>Search real catalog listings by product, brand, or category.</p></div>
        <div><span className="step-number">02</span><h3>Look a little closer</h3><p>Sign in and request an AI analysis of the listing’s sustainability factors and potential alternatives.</p></div>
        <div><span className="step-number">03</span><h3>Choose with perspective</h3><p>Use the estimate as a starting point, not a certification. Unknowns and trade-offs matter.</p></div>
      </div><details className="rating-guide"><summary>What do the score ratings mean?<Icon name="info" size={15} /></summary><p>0–39 Low · 40–59 Moderate · 60–79 Good · 80–100 Excellent. These labels are EcoSearch’s own interpretation, not an official scientific standard. Catalog scores may be illustrative or manually supplied. Only results explicitly labeled “AI Sustainability Analysis” were generated through the AI analysis service.</p></details></section>
    </>
  );
}
