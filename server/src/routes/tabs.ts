import { Hono } from 'hono';
import { z } from 'zod';
import { listTabs, replaceTabs } from '../cache/tabs.js';

export const tabsRouter = new Hono();

const PutBody = z.object({
  tabs: z
    .array(
      z.object({
        lawId: z.string().min(1),
        title: z.string(),
      }),
    )
    .max(200),
});

tabsRouter.get('/', (c) => {
  const tabs = listTabs();
  return c.json({ tabs });
});

tabsRouter.put('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  const parsed = PutBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid', issues: parsed.error.format() }, 400);
  }
  // Same lawId twice would have collapsed via PRIMARY KEY on insert, so
  // reject it explicitly with a clear error rather than letting the
  // transaction abort.
  const seen = new Set<string>();
  for (const t of parsed.data.tabs) {
    if (seen.has(t.lawId)) {
      return c.json({ error: `duplicate lawId: ${t.lawId}` }, 400);
    }
    seen.add(t.lawId);
  }
  replaceTabs(parsed.data.tabs);
  return c.json({ ok: true, count: parsed.data.tabs.length });
});
