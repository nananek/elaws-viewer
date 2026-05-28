import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Use `vite preview` against the production build — no proxy to a backend,
    // so all `/api/**` requests must be mocked via `page.route`. Reference
    // local node_modules binaries directly so the command works regardless of
    // whether pnpm/npm is on PATH (e.g. inside Playwright's spawned shell).
    command: 'node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
