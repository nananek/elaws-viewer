import { Hono } from 'hono';
import { z } from 'zod';
import {
  listBookmarks, listBookmarksForLaw,
  createBookmark, softDeleteBookmark,
} from '../realm/bookmarks.js';
import { publishChange } from '../events.js';

export const bookmarksRouter = new Hono();

bookmarksRouter.get('/', async (c) => {
  const lawNo = c.req.query('lawNo');
  const items = lawNo ? await listBookmarksForLaw(lawNo) : await listBookmarks();
  return c.json({ count: items.length, bookmarks: items });
});

const CreateBody = z.object({
  lawNo: z.string().min(1),
  anchor: z.string(),
  title: z.string(),
  row: z.number().int().optional(),
  notes: z.string().nullable().optional(),
  filepath: z.string().optional(),
  order: z.number().int().optional(),
});

bookmarksRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid', issues: parsed.error.format() }, 400);
  }
  const uuid = await createBookmark(parsed.data);
  publishChange({ resource: 'bookmarks', clientId: c.req.header('x-client-id') ?? null });
  return c.json({ uuid }, 201);
});

bookmarksRouter.delete('/:uuid', async (c) => {
  const ok = await softDeleteBookmark(c.req.param('uuid'));
  if (ok) {
    publishChange({ resource: 'bookmarks', clientId: c.req.header('x-client-id') ?? null });
  }
  return c.json({ deleted: ok }, ok ? 200 : 404);
});
