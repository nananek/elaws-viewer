import { Hono } from 'hono';
import { searchGlobal, searchInLaw } from '../cache/fts.js';

export const searchRouter = new Hono();

searchRouter.get('/search/global', (c) => {
  const q = c.req.query('q') ?? '';
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  if (!q || q.trim().length < 2) return c.json({ q, count: 0, hits: [] });
  try {
    const hits = searchGlobal(q.trim(), limit);
    return c.json({ q, count: hits.length, hits });
  } catch (e) {
    return c.json({ q, count: 0, hits: [], error: String(e) }, 400);
  }
});

searchRouter.get('/search/in-law/:lawId', (c) => {
  const lawId = c.req.param('lawId');
  const q = c.req.query('q') ?? '';
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  if (!q || q.trim().length < 2) return c.json({ q, count: 0, hits: [] });
  try {
    const hits = searchInLaw(lawId, q.trim(), limit);
    return c.json({ q, count: hits.length, hits });
  } catch (e) {
    return c.json({ q, count: 0, hits: [], error: String(e) }, 400);
  }
});
