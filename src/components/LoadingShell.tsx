import type { ReactNode } from 'react';

/**
 * Static, deterministic first-paint shell for the EcoSearch preview.
 *
 * It is rendered by EcoSearchApp while the client bundle is still downloading
 * and before React hydrates. Because it is pure static markup (no hooks, no
 * window/localStorage/document access, no random values or timestamps), it
 * renders byte-for-byte identically on the server and on the client's first
 * (pre-mount) render — so hydration is clean and there is no mismatch.
 *
 * It reuses the app's own CSS class names (loaded via the layout) so the user
 * sees the real EcoSearch chrome immediately instead of a bare "Loading…"
 * spinner while the JS bundle downloads over a slow link. The real app swaps
 * in the moment it mounts.
 */

const Leaf = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 4c-9-2-16 1-16 8a7 7 0 0 0 12 5c4-4 4-9 4-13Z" />
    <path d="M4 21c1-6 5-10 11-13" />
  </svg>
);
const Search = ({ size = 23 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);
const Arrow = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);
const Box = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 9 9-4M12 12 3 8m9 4v10M8 5l9 5" />
  </svg>
);
const Sparkles = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" />
  </svg>
);
const Info = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6m0-10v.01" />
  </svg>
);

const categories = ['All products', 'Home', 'Clothing', 'Personal Care', 'Electronics', 'Food', 'Transportation'];
const suggestions = ['Water bottle', 'Bamboo', 'Reusable'];

export default function LoadingShell(): ReactNode {
  return (
    <div className="ecosearch-app" aria-busy="true" aria-label="Loading EcoSearch">
      <header className="site-header">
        <div className="header-inner">
          <span className="wordmark">
            <span className="brand-mark"><Leaf size={24} /></span>
            Eco<span>Search</span><span className="brand-dot">.</span>
          </span>
          <nav aria-label="Main navigation">
            <a href="#/">Explore products</a>
            <a href="#how-it-works">How it works</a>
            <a href="#/compare">Compare</a>
          </nav>
          <div className="header-auth">
            <button type="button" className="header-link">Login</button>
            <button type="button" className="header-signup">Create account <Arrow size={14} /></button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-orbit" aria-hidden="true"><Leaf size={30} /></div>
          <div className="hero-kicker"><span className="live-dot" /> Mindful choices. Meaningful change.</div>
          <h1>Small choices.<br /><span>A healthier planet.</span></h1>
          <p className="hero-description">Discover everyday products with a little more perspective.<br className="desktop-break" /> Explore their impact, understand the trade-offs, and find a better fit.</p>
          <div className="search-bar" aria-hidden="true">
            <div className="search-bar__row">
              <Search size={23} />
              <input type="search" readOnly aria-label="Search EcoSearch" placeholder="A better water bottle? Start here…" />
              <button className="search-submit" type="button">Search <Arrow size={17} /></button>
            </div>
          </div>
          <div className="search-suggestions" aria-hidden="true">
            <span>A little inspiration:</span>
            {suggestions.map((term) => (
              <button type="button" key={term}>{term}<Arrow size={12} /></button>
            ))}
          </div>
          <div className="hero-trust" aria-hidden="true">
            <span><Box size={15} /> Real products</span><i />
            <span><Sparkles size={15} /> Thoughtful AI insights</span><i />
            <span><Leaf size={15} /> Better-informed choices</span>
          </div>
        </section>

        <section className="catalog-section page-width" aria-label="Product catalog" aria-hidden="true">
          <div className="catalog-heading">
            <div>
              <p className="eyebrow">THE EVERYDAY, RECONSIDERED</p>
              <h2>Find your next better choice</h2>
            </div>
            <div className="catalog-caption"><span className="small-leaf"><Leaf size={16} /></span>Good things start with curiosity.</div>
          </div>
          <div className="catalog-toolbar">
            <div className="category-filters">
              {categories.map((category, index) => (
                <button type="button" key={category} className={index === 0 ? 'category-filter is-active' : 'category-filter'}>{category}</button>
              ))}
            </div>
          </div>
          <div className="results-meta">
            <span>Finding thoughtful products…</span>
            <span className="estimate-note"><Info size={14} /> Scores are estimates, not certifications</span>
          </div>
          <div className="results-grid">
            {[0, 1, 2].map((i) => (
              <div className="product-skeleton" key={i}>
                <div /><span /><span /><span />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
