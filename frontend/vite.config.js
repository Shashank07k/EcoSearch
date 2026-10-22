import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin local API. An explicit VITE_API_BASE_URL can override this.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        // Bound how long the proxy waits on Express. Without this, a backend
        // that accepts the connection but never replies (e.g. a hung database
        // query) leaves the browser request pending indefinitely and the UI
        // stuck on skeleton cards. On timeout the `error` handler below returns
        // the same JSON envelope the API uses, so the app can show a real error.
        timeout: 15_000,
        proxyTimeout: 15_000,
        configure(proxy) {
          proxy.on('error', (_error, _req, res) => {
            // `res` can be a Socket for upgrade-style errors; guard before use.
            if (!res || typeof res.writeHead !== 'function' || res.headersSent) return;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: {
                status: 503,
                message: 'The EcoSearch API is temporarily unavailable. Please make sure the backend server is running (port 5000) and try again.',
                code: 'API_UNAVAILABLE',
              },
            }));
          });
        },
      },
    },
  },
});
