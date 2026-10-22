import Icon from '../components/Icon.jsx';
import { useSearchHistory } from '../hooks/useSearchHistory.js';
import { formatSearchTime, historySearchPath } from '../utils/history.js';
import { navigate } from '../hooks/useHashRoute.js';

export default function HistoryPage() {
  const history = useSearchHistory();

  return (
    <section className="library-page page-width">
      <div className="library-header">
        <p className="eyebrow">YOUR SEARCHES</p>
        <h1>Search history</h1>
        <p>Recent catalog searches on this account. Repeating the same query within 10 minutes updates the existing entry.</p>
      </div>

      {history.status === 'loading' && (
        <p className="results-message results-message--loading" role="status"><span className="spinner" /> Loading history…</p>
      )}

      {history.status === 'error' && (
        <div className="results-message results-message--error" role="alert">
          <Icon name="info" size={28} />
          <h3>Could not load history</h3>
          <p>{history.error}</p>
          <button type="button" onClick={() => history.reload(1)}><Icon name="refresh" size={16} /> Try again</button>
        </div>
      )}

      {history.status === 'success' && history.items.length === 0 && (
        <div className="results-message results-message--empty" role="status">
          <Icon name="search" size={32} />
          <h3>No searches yet</h3>
          <p>Signed-in searches appear here. The public catalog still works without an account.</p>
          <button type="button" onClick={() => navigate('/')}><Icon name="search" size={16} /> Explore products</button>
        </div>
      )}

      {history.status === 'success' && history.items.length > 0 && (
        <>
          <div className="library-toolbar">
            <span>{history.total} saved search{history.total === 1 ? '' : 'es'}</span>
            <button type="button" className="text-action" onClick={() => history.clear()}>Clear history</button>
          </div>
          <ul className="history-list">
            {history.items.map((item) => (
              <li key={item.id} className="history-item">
                <div>
                  <strong>{item.query}</strong>
                  <p>{item.resultCount} result{item.resultCount === 1 ? '' : 's'} · {formatSearchTime(item.searchedAt)}</p>
                </div>
                <div className="history-actions">
                  <button type="button" onClick={() => navigate(historySearchPath(item.query))}>
                    <Icon name="search" size={15} /> Search again
                  </button>
                  <button type="button" className="danger-action" onClick={() => history.remove(item.id)}>
                    <Icon name="close" size={15} /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {history.totalPages > 1 && (
            <nav className="pagination" aria-label="History pages">
              <button type="button" disabled={history.page <= 1} onClick={() => history.reload(history.page - 1)}>Previous</button>
              <span>Page {history.page} of {history.totalPages}</span>
              <button type="button" disabled={history.page >= history.totalPages} onClick={() => history.reload(history.page + 1)}>Next</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
