import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const MAX = 4;
const STORAGE_KEY = 'ecosearch_compare';

function readStored() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string') : [];
  } catch {
    return [];
  }
}

function writeStored(items) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore storage failures */ }
}

const ComparisonContext = createContext(null);

export function ComparisonProvider({ children }) {
  const [items, setItems] = useState(() => readStored());

  useEffect(() => { writeStored(items); }, [items]);

  const isSelected = useCallback((id) => items.some((item) => item.id === id), [items]);
  const canAddMore = items.length < MAX;

  const addProduct = useCallback((product) => {
    if (!product?.id || !product?.name) return false;
    setItems((previous) => {
      if (previous.some((item) => item.id === product.id)) return previous;
      if (previous.length >= MAX) return previous;
      return [...previous, { id: product.id, name: product.name }];
    });
    return true;
  }, []);

  const removeProduct = useCallback((id) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const clearProducts = useCallback(() => { setItems([]); }, []);

  const value = useMemo(() => ({
    selectedProducts: items,
    addProduct,
    removeProduct,
    clearProducts,
    isSelected,
    canAddMore,
    count: items.length,
    max: MAX,
  }), [items, addProduct, removeProduct, clearProducts, isSelected, canAddMore]);

  return <ComparisonContext.Provider value={value}>{children}</ComparisonContext.Provider>;
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (!context) throw new Error('useComparison must be used inside <ComparisonProvider>');
  return context;
}
