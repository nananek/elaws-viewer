import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { tailscaleAuth } from './middleware/auth.js';
import { lawsRouter } from './routes/laws.js';
import { selectionsRouter } from './routes/selections.js';
import { searchRouter } from './routes/search.js';
import { bookmarksRouter } from './routes/bookmarks.js';
import { tagsRouter } from './routes/tags.js';
import { ioRealmRouter } from './routes/ioRealm.js';

const app = new Hono();

app.use('*', logger());
app.use('/api/*', cors({ origin: (origin) => origin ?? '*', credentials: true }));
app.use('/api/*', tailscaleAuth());

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'elaws-viewer',
    version: '0.0.0',
    time: new Date().toISOString(),
  }),
);

app.route('/api/laws', lawsRouter);
app.route('/api', selectionsRouter);
app.route('/api', searchRouter);
app.route('/api/bookmarks', bookmarksRouter);
app.route('/api/tags', tagsRouter);
app.route('/api', ioRealmRouter);

const port = parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';

serve({ fetch: app.fetch, port, hostname: host }, (info) => {
  console.log(`[elaws-viewer] listening on http://${info.address}:${info.port}`);
});
