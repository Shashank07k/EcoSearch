import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A user's saved product. Uniqueness of (user, product) is enforced by a
 * compound unique index at the database level.
 */
const favoriteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { transform: toPublicJSON },
    toObject: { transform: toPublicJSON },
  },
);

favoriteSchema.index({ user: 1, product: 1 }, { unique: true });
favoriteSchema.index({ user: 1, createdAt: -1 });

function toPublicJSON(_doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  if (ret.user?._id) ret.user = ret.user._id.toString();
  else if (ret.user) ret.user = ret.user.toString();
  if (ret.product && typeof ret.product === 'object' && ret.product._id) {
    ret.product = {
      ...ret.product,
      id: ret.product._id.toString(),
    };
    delete ret.product._id;
    delete ret.product.__v;
  } else if (ret.product) {
    ret.product = ret.product.toString();
  }
  return ret;
}

const Favorite = mongoose.model('Favorite', favoriteSchema);

export default Favorite;
