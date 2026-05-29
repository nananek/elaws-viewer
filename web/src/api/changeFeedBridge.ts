import type { QueryClient } from '@tanstack/react-query';
import { subscribeChangeFeed } from './events.js';
import { getClientId } from './client.js';

/**
 * Wire the unified change feed to react-query invalidations.
 *
 * Server publishes a `change` event per mutation; we map non-tabs
 * resources to the corresponding queryKey so react-query refetches the
 * active queries. (Inactive queries are marked stale but not refetched
 * until they're rendered again — saves traffic.)
 *
 * `tabs` events are handled by `state/tabs.ts` directly (rich payload),
 * not here. We skip them in this bridge.
 *
 * Self-echo: a session's own POST/PATCH/DELETE returns the freshly
 * mutated state in the response body itself (react-query writes it
 * back via setQueryData in the mutation onSuccess). The broadcast then
 * arrives carrying our own clientId. Re-invalidating on echo would
 * cause an extra GET round-trip per local edit; we drop these.
 */
export function registerChangeFeedInvalidations(queryClient: QueryClient): () => void {
  const myId = getClientId();
  return subscribeChangeFeed((change) => {
    if (change.clientId === myId) return; // self-echo
    switch (change.resource) {
      case 'tabs':
        return; // handled by useTabs
      case 'selections':
        // Client keys selections by `lawId` (e-Gov filename), not
        // `lawNo` (Japanese law number) which is what the server
        // publishes. Invalidate the whole `['selections', ...]`
        // prefix and let react-query refetch only the active law.
        void queryClient.invalidateQueries({ queryKey: ['selections'] });
        return;
      case 'bookmarks':
        void queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
        return;
      case 'tags':
        void queryClient.invalidateQueries({ queryKey: ['tags'] });
        return;
      case 'folders':
        void queryClient.invalidateQueries({ queryKey: ['folders'] });
        return;
    }
  });
}
