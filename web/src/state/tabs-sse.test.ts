import { describe, expect, it, vi } from 'vitest';

/**
 * SSE-driven updates to the tabs store.
 *
 * Validates the three rules that keep multi-session sync correct:
 *   1. A broadcast whose `clientId` matches our own is a self-echo and
 *      must NOT cause a setState.
 *   2. A broadcast from a different client must update state to the
 *      broadcasted list.
 *   3. The setState triggered by a broadcast must NOT cause a follow-up
 *      PUT (otherwise A→B→A→B → infinite ping-pong).
 *
 * The unified change feed delivers events tagged by `resource`; the
 * tabs consumer only acts on `resource: 'tabs'`. We mock the feed
 * subscriber so a single test can dispatch whichever events it likes.
 */

type ChangeEvent =
  | { resource: 'tabs'; tabs: { lawId: string; title: string }[]; clientId: string | null }
  | { resource: 'selections'; lawNo: string | null; clientId: string | null }
  | { resource: 'bookmarks'; clientId: string | null }
  | { resource: 'tags'; clientId: string | null }
  | { resource: 'folders'; clientId: string | null };

vi.mock('../api/tabs.js', () => {
  const putTabs = vi.fn(async () => ({ ok: true as const, count: 0 }));
  return {
    fetchTabs: vi.fn(async () => ({ tabs: [] })),
    putTabs,
    getClientId: () => 'MY-CLIENT',
    __test_putTabs: putTabs,
  };
});

vi.mock('../api/events.js', () => {
  let capture: (e: ChangeEvent) => void = () => {};
  return {
    subscribeChangeFeed: (cb: (e: ChangeEvent) => void) => {
      capture = cb;
      return () => { capture = () => {}; };
    },
    __test_emit: (e: ChangeEvent) => capture(e),
  };
});

async function reloadModule() {
  vi.resetModules();
  return import('./tabs.js');
}

async function bootHydrated() {
  const mod = await reloadModule();
  mod.startTabsSync();
  // Let the bootstrap fetch resolve AND the hydrate-driven schedulePut
  // debounce (80 ms) fire before any test starts asserting on PUTs.
  await new Promise((r) => setTimeout(r, 150));
  return mod;
}

describe('SSE-driven state updates', () => {
  it('ignores a broadcast whose clientId matches our own id (self-echo)', async () => {
    const mod = await bootHydrated();
    const api = (await import('../api/tabs.js')) as unknown as {
      __test_putTabs: ReturnType<typeof vi.fn>;
    };
    const events = (await import('../api/events.js')) as unknown as {
      __test_emit: (e: ChangeEvent) => void;
    };
    api.__test_putTabs.mockClear();
    events.__test_emit({
      resource: 'tabs',
      tabs: [{ lawId: 'A', title: 'X' }],
      clientId: 'MY-CLIENT',
    });
    expect(mod.useTabs.getState().tabs).toEqual([]);
    expect(api.__test_putTabs).not.toHaveBeenCalled();
  });

  it('applies a broadcast from another client to local state', async () => {
    const mod = await bootHydrated();
    const events = (await import('../api/events.js')) as unknown as {
      __test_emit: (e: ChangeEvent) => void;
    };
    events.__test_emit({
      resource: 'tabs',
      tabs: [{ lawId: 'B', title: '別端末' }],
      clientId: 'OTHER-CLIENT',
    });
    expect(mod.useTabs.getState().tabs).toEqual([
      { lawId: 'B', title: '別端末' },
    ]);
  });

  it('does NOT trigger a PUT when applying an SSE-driven update', async () => {
    const mod = await bootHydrated();
    void mod;
    const api = (await import('../api/tabs.js')) as unknown as {
      __test_putTabs: ReturnType<typeof vi.fn>;
    };
    const events = (await import('../api/events.js')) as unknown as {
      __test_emit: (e: ChangeEvent) => void;
    };
    api.__test_putTabs.mockClear();
    events.__test_emit({
      resource: 'tabs',
      tabs: [{ lawId: 'C', title: 'C' }],
      clientId: 'OTHER-CLIENT',
    });
    await new Promise((r) => setTimeout(r, 150));
    expect(api.__test_putTabs).not.toHaveBeenCalled();
  });

  it('non-tabs events are ignored by the tabs consumer (no state change)', async () => {
    const mod = await bootHydrated();
    const events = (await import('../api/events.js')) as unknown as {
      __test_emit: (e: ChangeEvent) => void;
    };
    const before = mod.useTabs.getState().tabs;
    events.__test_emit({
      resource: 'selections',
      lawNo: null,
      clientId: 'OTHER-CLIENT',
    });
    events.__test_emit({ resource: 'tags', clientId: 'OTHER-CLIENT' });
    expect(mod.useTabs.getState().tabs).toBe(before);
  });
});
