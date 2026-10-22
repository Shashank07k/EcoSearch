import { useCallback, useEffect, useState } from 'react';
import { getHistory, deleteHistoryEntry, clearHistory } from '../services/historyService.js';

export function useSearchHistory() {
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
      const response = await getHistory({ page, limit: 10 });
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
        error: error.message || 'Could not load search history.',
      }));
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const remove = useCallback(async (id) => {
    await deleteHistoryEntry(id);
    await load(state.page);
  }, [load, state.page]);

  const clear = useCallback(async () => {
    await clearHistory();
    await load(1);
  }, [load]);

  return { ...state, reload: load, remove, clear };
}
