/**
 * Unified server → client change feed.
 *
 * Server publishes a single `change` event per mutation. The payload
 * carries a `resource` discriminator plus a `clientId` so a session
 * that originated the change can ignore its own echo.
 *
 *   * `tabs` events carry the full new list (rich payload — useTabs
 *     applies it directly without an extra GET).
 *   * `selections` / `bookmarks` / `tags` / `folders` events are
 *     invalidation signals — the client invalidates the matching
 *     react-query key and lets react-query refetch.
 *
 * The EventSource is shared: every subscriber registered via
 * `subscribeChangeFeed()` is fanned out from a single connection.
 */

export type ChangeEvent =
  | {
      resource: 'tabs';
      tabs: { lawId: string; title: string }[];
      clientId: string | null;
    }
  | {
      resource: 'selections';
      lawNo: string | null;
      clientId: string | null;
    }
  | { resource: 'bookmarks'; clientId: string | null }
  | { resource: 'tags'; clientId: string | null }
  | { resource: 'folders'; clientId: string | null };

const subscribers = new Set<(e: ChangeEvent) => void>();
let connectionStarted = false;
let eventSource: EventSource | null = null;

function ensureConnected(): void {
  if (connectionStarted) return;
  connectionStarted = true;
  if (typeof window === 'undefined') return;
  eventSource = new EventSource('/api/events');
  eventSource.addEventListener('change', (e: MessageEvent<string>) => {
    let change: ChangeEvent;
    try {
      change = JSON.parse(e.data) as ChangeEvent;
    } catch (err) {
      console.warn('[events] malformed SSE payload:', err);
      return;
    }
    for (const s of subscribers) {
      try { s(change); } catch (cb) { console.error('[events] subscriber threw:', cb); }
    }
  });
  // `ping` heartbeats are no-ops on the client.
}

/** Register a change-event listener. Returns an unsubscribe fn. */
export function subscribeChangeFeed(
  listener: (e: ChangeEvent) => void,
): () => void {
  ensureConnected();
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

/** Test-only: tear down the shared EventSource. */
export function __resetChangeFeedForTests(): void {
  subscribers.clear();
  eventSource?.close();
  eventSource = null;
  connectionStarted = false;
}
