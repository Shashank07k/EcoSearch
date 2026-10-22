import { scoreRating } from './analysis.js';

// The EcoSearch catalog is INR-based. Backend prices are numeric rupee values;
// this is the single place where they are formatted for display.
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function formatPrice(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 'Price not supplied';
  return currency.format(value);
}

// Retain the existing helper name while using the shared Phase 3 rating bands.
export function scoreBand(score) {
  return scoreRating(score).band;
}
