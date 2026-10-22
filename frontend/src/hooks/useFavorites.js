import { useCallback, useEffect, useState } from 'react';
import { getFavorites, addFavorite, removeFavorite } from '../services/favoritesService.js';

export function useFavoritesList() {
  const [state, setState] = useState({
    status: 'loading',
    items: [],
    page: 1,
    total: 0,
    totalPages: 0,
    error: null,
  });

  const load = useCallback(async (page = 1) => {
    setState((previous) => ({ ...previous, status: 'loading', error: null, page }));
    try {
      const response = await getFavorites({ page, limit: 12 });
      const data = response.data;
      setState({
        status: 'success',
        items: data.items,
        page: data.page,
        total: data.total,
        totalPages: data.totalPages,
        error: null,
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        status: 'error',
        items: [],
        error: error.message || 'Could not load favorites.',
      }));
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  return { ...state, reload: load };
}

export function useFavoriteToggle(product) {
  const [favorited, setFavorited] = useState(Boolean(product?.favorited));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { setFavorited(Boolean(product?.favorited)); }, [product?.id, product?.favorited]);

  const toggle = useCallback(async () => {
    if (!product?.id || busy) return;
    setBusy(true);
    setError(null);
    const previous = favorited;
    setFavorited(!previous);
    try {
      if (previous) await removeFavorite(product.id);
      else await addFavorite(product.id);
      return !previous;
    } catch (err) {
      setFavorited(previous);
      setError(err.message || 'Could not update favorites.');
      return previous;
    } finally {
      setBusy(false);
    }
  }, [product?.id, favorited, busy]);

  return { favorited, busy, error, toggle };
}
