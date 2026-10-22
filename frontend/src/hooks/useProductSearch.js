import { useCallback, useEffect, useRef, useState } from 'react';
import { getProducts, searchProducts } from '../services/productService.js';
import { ApiError } from '../services/apiClient.js';

export function useProductSearch(initialQuery = '') {
  const [state, setState] = useState({ status: 'idle', query: '', results: [], error: null, page: 1, total: 0, totalPages: 1 });
  const requestRef = useRef(null);

  const load = useCallback(async (rawQuery = '', page = 1) => {
    const query = rawQuery.trim();
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    // A request is "stale" only when a newer request has taken over the UI, or
    // the component unmounted (cleanup nulls requestRef). Checking staleness
    // instead of `controller.signal.aborted` is what guarantees the LATEST
    // request always settles the state: success, empty, or error. Previously an
    // aborted-but-still-current request could return early and strand the UI in
    // 'loading' forever (infinite skeleton cards).
    const isStale = () => requestRef.current !== controller;

    setState((previous) => ({ ...previous, status: 'loading', query, page, error: null }));
    try {
      const data = query
        ? await searchProducts(query, { signal: controller.signal })
        : await getProducts({ page, limit: 9 }, { signal: controller.signal });
      if (isStale()) return;
      const results = query ? data.results : data.products;
      if (!Array.isArray(results) || !results.every((p) => typeof p?.id === 'string' && typeof p?.name === 'string' && typeof p?.category === 'string')) {
        throw new ApiError('The catalog returned an invalid response. Please try again.');
      }
      setState({ status: 'success', query, results, error: null, page, total: query ? results.length : data.total, totalPages: query ? 1 : data.totalPages });
    } catch (error) {
      if (isStale()) return;
      const message = error?.name === 'AbortError'
        ? 'The request was cancelled. Please try again.'
        : error?.code === 'TIMEOUT'
          ? 'EcoSearch took too long to load the catalog. Please try again.'
          : (error?.message || 'Search failed. Please try again.');
      setState((previous) => ({ ...previous, status: 'error', results: [], error: message }));
    }
  }, []);

  useEffect(() => {
    load(initialQuery);
    return () => {
      requestRef.current?.abort();
      // Nulling the ref marks the in-flight request stale so its late
      // resolution cannot setState on an unmounted hook.
      requestRef.current = null;
    };
  }, [load, initialQuery]);

  const search = useCallback((query) => load(query, 1), [load]);
  const browse = useCallback((page = 1) => load('', page), [load]);
  return { ...state, search, browse, reset: browse, retry: () => load(state.query, state.page) };
}
