import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { tailscaleAuth } from './middleware/auth.js';
import { lawsRouter } from './routes/laws.js';
import { selectionsRouter } from './routes/selections.js';
import { searchRouter } from './routes/search.js';
import { bookmarksRouter } from './routes/bookmarks.js';
import { tagsRouter } from './routes/tags.js';
import { ioRealmRouter } from './routes/ioRealm.js';
import { startBackupScheduler } from './realm/backup-scheduler.js';
import { runDailyBackup } from './realm/backup.js';
import { APP_VERSION } from './version.js';

const app = new Hono();

app.use('*', logger());
// Stamp every /api response with the server's current build version so the
// client can detect a mismatch with its own embedded version and prompt for
// reload. Must run before cors so Access-Control-Expose-Headers picks it up.
app.use('/api/*', async (c, next) => {
  c.header('X-App-Version', APP_VERSION);
  await next();
});
app.use('/api/*', cors({
  origin: (origin) => origin ?? '*',
  credentials: true,
  exposeHeaders: ['X-App-Version'],
}));
app.use('/api/*', tailscaleAuth());

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'elaws-viewer',
    version: APP_VERSION,
    time: new Date().toISOString(),
  }),
);

app.get('/api/version', (c) => c.json({ version: APP_VERSION }));

app.route('/api/laws', lawsRouter);
app.route('/api', selectionsRouter);
app.route('/api', searchRouter);
app.route('/api/bookmarks', bookmarksRouter);
app.route('/api/tags', tagsRouter);
app.route('/api', ioRealmRouter);

app.post('/api/backup', async (c) => {
  try {
    const path = await runDailyBackup();
    return c.json({ ok: true, path });
  } catch (e) {
    return c.json({ ok: false, error: String(e) }, 500);
  }
});

// Serve compiled SPA in production (no-op in dev where vite serves on :5173)
const webDist = resolve(import.meta.dirname, '..', '..', 'web', 'dist');
if (existsSync(webDist)) {
  app.use('/*', serveStatic({ root: webDist }));
  const indexHtml = existsSync(resolve(webDist, 'index.html'))
    ? readFileSync(resolve(webDist, 'index.html'), 'utf8')
    : null;
  if (indexHtml) {
    // SPA fallback: any non-/api, non-asset GET returns index.html
    app.get('*', (c) => c.html(indexHtml));
  }
}

const port = parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';

serve({ fetch: app.fetch, port, hostname: host }, (info) => {
  console.log(`[elaws-viewer] listening on http://${info.address}:${info.port}`);
  startBackupScheduler();
});
