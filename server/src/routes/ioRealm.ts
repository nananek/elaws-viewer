import { Hono } from 'hono';
import { exportRealmBytes, importRealmBytes } from '../realm/export.js';

export const ioRealmRouter = new Hono();

ioRealmRouter.get('/export/realm', async (c) => {
  const bytes = await exportRealmBytes();
  const filename = `annotations-${new Date().toISOString().slice(0, 10)}.realm`;
  return c.body(new Uint8Array(bytes), 200, {
    'content-type': 'application/octet-stream',
    'content-disposition': `attachment; filename="${filename}"`,
    'content-length': String(bytes.length),
  });
});

ioRealmRouter.post('/import/realm', async (c) => {
  const form = await c.req.parseBody({ all: false });
  const f = form.file;
  if (!f || typeof f === 'string') {
    return c.json({ error: 'no file' }, 400);
  }
  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.length < 100) {
    return c.json({ error: 'file too small' }, 400);
  }
  const stats = await importRealmBytes(buf);
  return c.json({ ok: true, stats });
});
