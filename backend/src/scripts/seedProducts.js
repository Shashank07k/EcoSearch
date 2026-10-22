/**
 * Development seed script: populates the `products` collection with
 * demonstration records.
 *
 *   npm run seed            # replaces existing products
 *   npm run seed -- --append  # keeps existing products, adds the demo set
 *
 * Only the `products` collection is touched — no other collection or
 * database is dropped. Sustainability values are illustrative placeholders
 * for the future AI phase, not scientific measurements.
 */
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import Product from '../models/Product.js';
import { demoProducts } from './seedData.js';

const append = process.argv.includes('--append');

async function seed() {
  if (!config.mongodbUri) {
    console.error('[seed] MONGODB_URI is not set. Configure backend/.env first.');
    process.exit(1);
  }

  console.info(`[seed] Connecting to MongoDB…`);
  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 10_000 });
  console.info(`[seed] Connected to database "${mongoose.connection.name}".`);

  if (!append) {
    const { deletedCount } = await Product.deleteMany({});
    console.info(`[seed] Cleared ${deletedCount} existing product(s).`);
  }

  const inserted = await Product.insertMany(demoProducts);
  console.info(`[seed] Inserted ${inserted.length} product(s) into "products".`);

  const total = await Product.countDocuments();
  console.info(`[seed] Collection now contains ${total} product(s).`);
}

seed()
  .catch((error) => {
    console.error(`[seed] Failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
