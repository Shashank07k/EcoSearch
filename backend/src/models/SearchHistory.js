import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One recorded catalog search belonging to an authenticated user.
 * `normalizedQuery` is a lowercase, whitespace-collapsed form used only for
 * de-duplication; the public API returns the original trimmed `query`.
 */
const searchHistorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    query: {
      type: String,
      required: [true, 'query is required'],
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    normalizedQuery: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    resultCount: { type: Number, required: true, min: [0, 'resultCount must be >= 0'] },
    searchedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    toJSON: { transform: toPublicJSON },
    toObject: { transform: toPublicJSON },
  },
);

searchHistorySchema.index({ user: 1, searchedAt: -1 });
searchHistorySchema.index({ user: 1, normalizedQuery: 1 });

function toPublicJSON(_doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  delete ret.normalizedQuery;
  if (ret.user?._id) ret.user = ret.user._id.toString();
  else if (ret.user) ret.user = ret.user.toString();
  return ret;
}

const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);

export default SearchHistory;
