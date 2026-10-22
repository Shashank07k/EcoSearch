import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './frontend/test/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8000 },
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', headless: true, viewport: { width: 1360, height: 1000 }, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node backend/test/support/browserServer.js',
      url: 'http://127.0.0.1:5010/api/health',
      env: {
        NODE_ENV: 'test',
        PORT: '5010',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/ecosearch_test_browser',
        JWT_SECRET: 'browser-test-only-secret-not-for-production-0123456789',
        JWT_EXPIRES_IN: '1h',
      },
      reuseExistingServer: false,
    },
    {
      command: 'npm --prefix frontend run dev -- --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:5010/api' },
      reuseExistingServer: false,
    },
  ],
});
