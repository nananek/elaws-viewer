import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { tailscaleAuth } from './middleware/auth.js';
import { lawsRouter } from './routes/laws.js';

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

const port = parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';

serve({ fetch: app.fetch, port, hostname: host }, (info) => {
  console.log(`[elaws-viewer] listening on http://${info.address}:${info.port}`);
});
