import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { subscribeChanges, type ChangeEvent } from '../events.js';
import { listTabs } from '../cache/tabs.js';

export const eventsRouter = new Hono();

/**
 * Unified change feed.
 *
 *   * `change` events fire whenever any mutating route publishes. Each
 *     event names a `resource` (`tabs` | `selections` | `bookmarks` |
 *     `tags` | `folders`). The `tabs` event carries the full list so
 *     the client can apply it directly; the others carry only the
 *     `clientId` (with `lawNo` for `selections` create) and the client
 *     invalidates react-query.
 *
 *   * On connect we synthesise a one-time `tabs` event with the
 *     current SQLite snapshot so `useTabs` can hydrate from the SSE
 *     stream (the old GET /api/tabs cold-start fetch is kept too —
 *     belt and braces).
 *
 *   * `ping` events every 30 s keep idle proxies (Tailscale Funnel,
 *     nginx) from tearing the long-lived connection down.
 */
eventsRouter.get('/', (c) => {
  return streamSSE(c, async (stream) => {
    // Initial tabs snapshot. `clientId: null` flags "not anyone's
    // echo" so the receiver always applies it.
    await stream.writeSSE({
      event: 'change',
      data: JSON.stringify({
        resource: 'tabs',
        tabs: listTabs(),
        clientId: null,
      } satisfies ChangeEvent),
    });

    const queue: ChangeEvent[] = [];
    let resolveOne: (() => void) | null = null;
    const unsub = subscribeChanges((change) => {
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
            event: 'change',
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
