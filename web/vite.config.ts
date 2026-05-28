import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// App version embedded at build time. Sources, in order:
//   1. $APP_VERSION (e.g. CI passes a tag or full SHA)
//   2. git short SHA of HEAD
//   3. literal "dev"
function resolveAppVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'dev';
  }
}
const APP_VERSION = resolveAppVersion();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'elaws-viewer',
        short_name: 'elaws',
        description: '個人用 Web 法令ビューア',
        theme_color: '#faf6ee',
        background_color: '#faf6ee',
        display: 'standalone',
        start_url: '/',
        lang: 'ja',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // When the user clicks the update banner, we want the freshly fetched
        // SW to take over immediately on reload — no second refresh required.
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/laws/') && url.pathname.includes('/body'),
            handler: 'NetworkFirst',
            options: { cacheName: 'law-body', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/selections'),
            handler: 'NetworkFirst',
            options: { cacheName: 'selections', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['realm', '@hono/node-server'],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
