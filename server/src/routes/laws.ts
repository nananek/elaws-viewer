import { Hono } from 'hono';
import { listDownloadedLaws } from '../realm/downloads.js';

export const lawsRouter = new Hono();

lawsRouter.get('/', async (c) => {
  const laws = await listDownloadedLaws();
  return c.json({ count: laws.length, laws });
});
