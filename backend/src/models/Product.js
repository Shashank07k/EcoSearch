import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A single named factor contributing to a product's sustainability score.
 * Shared structure for catalog entries and validated AI analysis factors.
 */
const sustainabilityFactorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    impact: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral',
    },
    description: { type: String, trim: true },
  },
  { _id: false },
);

/**
 * A suggested eco-friendly alternative. Either references another catalog
 * product (`productId`) or describes an external option by name.
 */
const ecoAlternativeSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true, trim: true },
    reason: { type: String, trim: true },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    name: { type: String, required: [true, 'name is required'], trim: true },
    description: { type: String, trim: true },
    category: { type: String, required: [true, 'category is required'], trim: true },
    brand: { type: String, trim: true },
    price: { type: Number, min: [0, 'price must be >= 0'] },
    imageUrl: { type: String, trim: true },
    sustainability: {
      score: {
        type: Number,
        min: [0, 'sustainability.score must be >= 0'],
        max: [100, 'sustainability.score must be <= 100'],
      },
      summary: { type: String, trim: true },
      factors: { type: [sustainabilityFactorSchema], default: [] },
      // Server-managed provenance; manual and seed records do not set these.
      analyzedAt: { type: Date },
      analysisVersion: { type: String },
      analysisInputHash: { type: String, select: false },
    },
    ecoAlternatives: { type: [ecoAlternativeSchema], default: [] },
  },
  {
    timestamps: true, // createdAt / updatedAt
    toJSON: { transform: toPublicJSON },
    toObject: { transform: toPublicJSON },
  },
);

// Indexes supporting listing and search.
productSchema.index({ category: 1 });
productSchema.index({ name: 1 });

/**
 * Consistent public representation: `id` instead of `_id`, no `__v`.
 */
function toPublicJSON(_doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  if (ret.sustainability) delete ret.sustainability.analysisInputHash;
  return ret;
}

const Product = mongoose.model('Product', productSchema);

export default Product;
