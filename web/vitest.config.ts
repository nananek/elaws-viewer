import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'dev-dist/**', 'test-results/**', 'playwright-report/**'],
  },
});
