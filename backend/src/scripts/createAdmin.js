/**
 * Development/admin bootstrap: create or update ONE administrator account from
 * environment variables. This is the ONLY supported way to create an admin;
 * normal /api/auth/register can never assign the admin role.
 *
 *   ADMIN_NAME="Ada Admin" \
 *   ADMIN_EMAIL="admin@example.com" \
 *   ADMIN_PASSWORD="StrongPassword123!" \
 *   npm run create-admin
 *
 * The script is idempotent (re-running updates name/password/role). It never
 * prints the password and must be run explicitly.
 */
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import User from '../models/User.js';
import { hashPassword } from '../utils/password.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const { name, email, password } = config.admin;

  if (!name || !EMAIL_PATTERN.test(email) || !password) {
    console.error(
      '[create-admin] Set ADMIN_NAME, a valid ADMIN_EMAIL and ADMIN_PASSWORD ' +
        'in backend/.env (or the shell environment), then re-run.',
    );
    process.exit(1);
  }
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    console.error('[create-admin] ADMIN_PASSWORD must be at least 8 characters and include a letter and a number.');
    process.exit(1);
  }
  if (!config.mongodbUri) {
    console.error('[create-admin] MONGODB_URI is not configured. Set it in backend/.env first.');
    process.exit(1);
  }

  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 10_000 });
  const passwordHash = await hashPassword(password);
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { name, passwordHash, role: 'admin' } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  // Deliberately log only non-secret identity fields.
  console.info(`[create-admin] Administrator ready — role=${user.role} email=${user.email}`);
}

main()
  .catch((error) => {
    console.error('[create-admin] Failed to create administrator.');
    console.error(error?.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
