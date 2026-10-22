import Icon from './Icon.jsx';
import { useComparison } from '../context/ComparisonContext.jsx';
import { navigate } from '../hooks/useHashRoute.js';

export default function CompareBar() {
  const { count, max, selectedProducts, clearProducts } = useComparison();
  if (count === 0) return null;
  return (
    <div className="compare-bar" role="status" aria-live="polite">
      <span><Icon name="box" size={16} /> Selected: {count}/{max}</span>
      <span className="compare-chips">
        {selectedProducts.map((item) => <span className="compare-chip" key={item.id}>{item.name}</span>)}
      </span>
      <button type="button" className="secondary-action" onClick={clearProducts}>Clear</button>
      <button
        type="button"
        className="primary-action"
        disabled={count < 2}
        onClick={() => navigate('/compare')}
      >
        <Icon name="box" size={15} /> Compare Selected
      </button>
    </div>
  );
}
