import mongoose from 'mongoose';

const recommendationCacheSchema = new mongoose.Schema(
  {
    fingerprint: { type: String, required: true, unique: true },
    explanation: { type: String, required: true },
    tradeoffs: { type: [mongoose.Schema.Types.Mixed], default: [] },
    policyVersion: { type: String, required: true },
    productSnapshot: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
);

export default mongoose.models.RecommendationCache ||
  mongoose.model('RecommendationCache', recommendationCacheSchema);
