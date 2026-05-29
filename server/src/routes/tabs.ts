import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { listTabs, replaceTabs, subscribeTabs, type TabsChange } from '../cache/tabs.js';

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
  const clientId = c.req.header('x-client-id') ?? null;
  replaceTabs(parsed.data.tabs, clientId);
  return c.json({ ok: true, count: parsed.data.tabs.length });
});

/**
 * Server-Sent Events feed of tab changes.
 *
 *   * Emits a `tabs` event with the current snapshot immediately on
 *     connect, then once per replaceTabs() call.
 *   * Emits `ping` events every 30 s so idle proxies (Tailscale Funnel,
 *     nginx with proxy_read_timeout) don't tear the connection down.
 *   * Payload: `{ tabs: UserTab[], clientId: string | null }`. The
 *     originating client compares the broadcast clientId against its
 *     own session id and ignores self-echoes (no setState → no PUT
 *     loop). Other clients apply it.
 */
tabsRouter.get('/events', (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: 'tabs',
      data: JSON.stringify({ tabs: listTabs(), clientId: null } satisfies TabsChange),
    });

    const queue: TabsChange[] = [];
    let resolveOne: (() => void) | null = null;
    const unsub = subscribeTabs((change) => {
      queue.push(change);
      resolveOne?.();
      resolveOne = null;
    });
    stream.onAbort(() => {
      unsub();
      resolveOne?.();
      resolveOne = null;
    });

    const heartbeat = setInterval(() => {
      void stream.writeSSE({ event: 'ping', data: '' });
    }, 30_000);

    try {
      while (!stream.aborted) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveOne = resolve;
          });
        }
        while (queue.length > 0 && !stream.aborted) {
          const change = queue.shift()!;
          await stream.writeSSE({
            event: 'tabs',
            data: JSON.stringify(change),
          });
        }
      }
    } finally {
      clearInterval(heartbeat);
      unsub();
    }
  });
});
