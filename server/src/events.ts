/**
 * In-process change feed.
 *
 * Every mutating route publishes a single ChangeEvent here after its
 * SQL/Realm commit succeeds. The /api/events SSE endpoint fans these
 * out to every connected browser session, which routes them to:
 *   * useTabs state (full payload, kept rich because we already had
 *     it from PR #29 and the merge/echo logic is wired up)
 *   * react-query cache invalidations (everything else)
 *
 * The bus is intentionally process-local: this app runs as a single
 * Hono instance behind Tailscale, so there's no inter-process fan-out
 * to worry about.
 */

export type ChangeEvent =
  | {
      resource: 'tabs';
      tabs: { lawId: string; title: string }[];
      clientId: string | null;
    }
  | {
      resource: 'selections';
      /** When known (e.g. POST /selections), narrows the invalidation. */
      lawNo: string | null;
      clientId: string | null;
    }
  | { resource: 'bookmarks'; clientId: string | null }
  | { resource: 'tags'; clientId: string | null }
  | { resource: 'folders'; clientId: string | null };

type Listener = (e: ChangeEvent) => void;

const listeners = new Set<Listener>();

/** Subscribe to all change events. Returns an unsubscribe fn. */
export function subscribeChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Notify every listener. A subscriber that throws cannot break other
 * subscribers or the caller — the publish call is "fire and forget"
 * from the route's perspective.
 */
export function publishChange(event: ChangeEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch (e) {
      console.error('[events] listener threw:', e);
    }
  }
}
