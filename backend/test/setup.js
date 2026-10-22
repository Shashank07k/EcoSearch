// Loaded into every Node test process via `node --import`.
// Provides test-only environment defaults. dotenv.config() in src/config
// never overwrites variables already set here, and these are not secrets.
process.env.NODE_ENV ??= 'test';
process.env.JWT_SECRET ??= 'test-only-secret-not-for-production-use-0123456789';
process.env.JWT_EXPIRES_IN ??= '1h';
