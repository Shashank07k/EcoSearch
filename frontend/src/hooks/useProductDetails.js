import { useCallback, useEffect, useRef, useState } from 'react';
import { getProductById } from '../services/productService.js';

/**
 * Loads one product from the existing GET /api/products/:id endpoint.
 * No second search/catalog implementation — this is only a detail fetch.
 */
export function useProductDetails(productId) {
  const [state, setState] = useState({ status: 'loading', product: null, error: null });
  const requestRef = useRef(null);

  const load = useCallback(async () => {
    if (!productId) {
      setState({ status: 'error', product: null, error: 'No product was selected.' });
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setState((previous) => ({ ...previous, status: 'loading', error: null }));
    try {
      const response = await getProductById(productId, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const product = response?.product;
      if (!product || typeof product.id !== 'string' || typeof product.name !== 'string') {
        throw new Error('This product could not be read. Please try again.');
      }
      setState({ status: 'success', product, error: null });
    } catch (error) {
      if (controller.signal.aborted || error.name === 'AbortError') return;
      const notFound = error.status === 404;
      setState({
        status: notFound ? 'missing' : 'error',
        product: null,
        error: notFound ? 'This product is no longer available.' : (error.message || 'Could not load this product.'),
      });
    }
  }, [productId]);

  useEffect(() => {
    load();
    return () => requestRef.current?.abort();
  }, [load]);

  return { ...state, reload: load };
}
