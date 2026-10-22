import app from './app.js';
import { config } from './config/env.js';
import { connectDatabase } from './config/db.js';

/**
 * Entry point.
 *
 * The HTTP server starts first so /api/health is reachable immediately;
 * the MongoDB connection is then established in the background.
 * connectDatabase() never throws — see src/config/db.js.
 */
async function startServer() {
  const server = app.listen(config.port, () => {
    console.info(
      `[server] EcoSearch API listening on http://localhost:${config.port} ` +
        `(${config.nodeEnv})`,
    );
  });

  await connectDatabase();
  return server;
}

startServer().catch((error) => {
  console.error('[server] Fatal startup error:', error);
  process.exit(1);
});
