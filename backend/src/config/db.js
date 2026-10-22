import mongoose from 'mongoose';
import { config } from './env.js';

const CONNECTION_OPTIONS = {
  // Fail fast (10s) instead of Mongoose's 30s default when MongoDB is
  // unreachable, so misconfiguration is reported quickly.
  serverSelectionTimeoutMS: 10_000,
};

/**
 * Connect to MongoDB using MONGODB_URI.
 *
 * The API intentionally keeps running when the database is unreachable:
 * there are no database-dependent endpoints yet, and GET /api/health
 * reports the live connection state so problems stay visible.
 *
 * @returns {Promise<boolean>} true when connected, false otherwise.
 */
export async function connectDatabase() {
  if (!config.mongodbUri) {
    console.warn('[db] MONGODB_URI is not configured — skipping MongoDB connection.');
    return false;
  }

  mongoose.connection.on('connected', () => {
    console.info('[db] MongoDB connected.');
  });
  mongoose.connection.on('error', (error) => {
    console.error(`[db] MongoDB connection error: ${error.message}`);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected.');
  });

  try {
    await mongoose.connect(config.mongodbUri, CONNECTION_OPTIONS);
    return true;
  } catch (error) {
    console.error(
      `[db] Failed to connect to MongoDB: ${error.message}. ` +
        'Check MONGODB_URI in backend/.env. The API keeps running without ' +
        'database features.',
    );
    return false;
  }
}
