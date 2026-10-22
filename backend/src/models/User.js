import mongoose from 'mongoose';

const { Schema } = mongoose;

export const USER_ROLES = ['user', 'admin'];
export const DEFAULT_ROLE = 'user';

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [2, 'name must be at least 2 characters'],
      maxlength: [80, 'name must be at most 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      validate: {
        validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: 'email must be a valid email address',
      },
    },
    // Always bcrypt-hashed; never returned by the API (see toPublicUser/toJSON).
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: DEFAULT_ROLE },
  },
  {
    timestamps: true, // createdAt / updatedAt
    toJSON: { transform: toPublicJSON },
    toObject: { transform: toPublicJSON },
  },
);

/** Public representation: `id`, no `_id`/`__v`, and never a password hash. */
function toPublicJSON(_doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  delete ret.passwordHash;
  return ret;
}

const User = mongoose.model('User', userSchema);

export default User;
