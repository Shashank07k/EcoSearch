import mongoose from 'mongoose';

const DATABASE_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

/** Builds the payload returned by GET /api/health. */
export function getHealthStatus() {
  const readyState = mongoose.connection.readyState;

  return {
    status: 'ok',
    service: 'ecosearch-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      connected: readyState === 1,
      state: DATABASE_STATES[readyState] ?? 'unknown',
    },
  };
}
