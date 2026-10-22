import { useCallback, useEffect, useRef, useState } from 'react';
import { compareProducts, recommendProducts } from '../services/comparisonService.js';

export function useComparisonData(productIds) {
  const [state, setState] = useState({
    status: 'idle',
    products: [],
    recommendation: null,
    error: null,
  });
  const requestRef = useRef(null);

  const load = useCallback(async () => {
    if (!Array.isArray(productIds) || productIds.length < 2) {
      setState({ status: 'idle', products: [], recommendation: null, error: 'Select at least 2 products to compare.' });
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setState((previous) => ({ ...previous, status: 'loading', error: null }));
    try {
      const [comparison, recommendation] = await Promise.all([
        compareProducts(productIds, { signal: controller.signal }),
        recommendProducts(productIds, { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setState({
        status: 'success',
        products: comparison.data.products,
        recommendation: recommendation.data,
        error: null,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      // Recommendation can still succeed even when AI is unavailable; keep the
      // comparison products if we already loaded them.
      setState((previous) => ({
        ...previous,
        status: 'error',
        error: error.message || 'Could not load this comparison.',
      }));
    }
  }, [productIds?.join?.(',')]);

  useEffect(() => {
    load();
    return () => requestRef.current?.abort();
  }, [load]);

  return { ...state, reload: load };
}
