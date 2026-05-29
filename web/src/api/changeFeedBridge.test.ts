import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

/**
 * Bridge between the unified change feed and react-query.
 *
 * Verifies the dispatch table: every non-tabs resource event invalidates
 * the matching queryKey, while `tabs` events are intentionally ignored
 * (handled by `state/tabs.ts` separately).
 *
 * Self-echo suppression: events whose `clientId` matches our own session
 * id never reach `invalidateQueries` — refetching after our own mutation
 * would just be redundant traffic (react-query's own onSuccess writes the
 * fresh data back).
 */

type ChangeEvent =
  | { resource: 'tabs'; tabs: { lawId: string; title: string }[]; clientId: string | null }
  | { resource: 'selections'; lawNo: string | null; clientId: string | null }
  | { resource: 'bookmarks'; clientId: string | null }
  | { resource: 'tags'; clientId: string | null }
  | { resource: 'folders'; clientId: string | null };

vi.mock('./client.js', () => ({ getClientId: () => 'MY-CLIENT' }));

vi.mock('./events.js', () => {
  let capture: (e: ChangeEvent) => void = () => {};
  return {
    subscribeChangeFeed: (cb: (e: ChangeEvent) => void) => {
      capture = cb;
      return () => { capture = () => {}; };
    },
    __test_emit: (e: ChangeEvent) => capture(e),
  };
});

async function setup() {
  vi.resetModules();
  const { registerChangeFeedInvalidations } = await import('./changeFeedBridge.js');
  const events = (await import('./events.js')) as unknown as {
    __test_emit: (e: ChangeEvent) => void;
  };
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, 'invalidateQueries');
  registerChangeFeedInvalidations(qc);
  return { events, qc, spy };
}

describe('changeFeedBridge → react-query', () => {
  it('selections event invalidates the [selections] key prefix', async () => {
    const { events, spy } = await setup();
    events.__test_emit({ resource: 'selections', lawNo: '民法', clientId: 'OTHER' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['selections'] });
  });

  it('bookmarks event invalidates [bookmarks]', async () => {
    const { events, spy } = await setup();
    events.__test_emit({ resource: 'bookmarks', clientId: 'OTHER' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['bookmarks'] });
  });

  it('tags event invalidates [tags]', async () => {
    const { events, spy } = await setup();
    events.__test_emit({ resource: 'tags', clientId: 'OTHER' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['tags'] });
  });

  it('folders event invalidates [folders]', async () => {
    const { events, spy } = await setup();
    events.__test_emit({ resource: 'folders', clientId: 'OTHER' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['folders'] });
  });

  it('tabs events are intentionally ignored (state/tabs.ts handles them)', async () => {
    const { events, spy } = await setup();
    events.__test_emit({
      resource: 'tabs',
      tabs: [{ lawId: 'A', title: 'X' }],
      clientId: 'OTHER',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('self-echoes do not invalidate (avoid redundant refetch after our own mutation)', async () => {
    const { events, spy } = await setup();
    events.__test_emit({ resource: 'bookmarks', clientId: 'MY-CLIENT' });
    events.__test_emit({ resource: 'selections', lawNo: null, clientId: 'MY-CLIENT' });
    events.__test_emit({ resource: 'tags', clientId: 'MY-CLIENT' });
    expect(spy).not.toHaveBeenCalled();
  });
});
