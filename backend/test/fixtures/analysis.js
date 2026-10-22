// Explicit test fixture, never imported by production code or seed scripts.
export const validAnalysis = {
  score: 84,
  summary: 'Test assessment: reuse may help, but manufacturing details are unknown. This is an estimate, not a certification.',
  factors: [
    { name: 'Reusability', impact: 'positive', description: 'The supplied listing describes a reusable item.' },
    { name: 'Manufacturing', impact: 'neutral', description: 'Energy use and supply-chain details were not supplied.' },
  ],
  alternatives: [{ name: 'Glass reusable bottle', reason: 'A possible reusable option; its relative impact depends on use and manufacture.' }],
};

export const testProduct = {
  _id: '507f1f77bcf86cd799439011',
  __v: 0,
  name: 'Reusable water bottle',
  description: 'A reusable stainless-steel bottle.',
  category: 'Home',
  brand: 'Test catalog',
  price: 24,
  sustainability: { score: 85, summary: 'Illustrative catalog value', factors: [] },
  ecoAlternatives: [],
};
