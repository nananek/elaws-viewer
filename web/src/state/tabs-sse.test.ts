import { describe, expect, it, vi, beforeEach } from 'vitest';

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
 */

vi.mock('../api/tabs.js', () => {
  let captureEvent: (
    payload: { tabs: { lawId: string; title: string }[]; clientId: string | null },
  ) => void = () => {};
  const putTabs = vi.fn(async () => ({ ok: true as const, count: 0 }));
  return {
    fetchTabs: vi.fn(async () => ({ tabs: [] })),
    putTabs,
    getClientId: () => 'MY-CLIENT',
    subscribeTabEvents: (cb: typeof captureEvent) => {
      captureEvent = cb;
      return () => { captureEvent = () => {}; };
    },
    __test_emit: (
      payload: { tabs: { lawId: string; title: string }[]; clientId: string | null },
    ) => captureEvent(payload),
    __test_putTabs: putTabs,
  };
});

async function reloadModule() {
  vi.resetModules();
  return import('./tabs.js');
}

beforeEach(() => {
  // Each test exercises startTabsSync afresh; tabs module keeps state at
  // module level.
});

describe('SSE-driven state updates', () => {
  it('ignores a broadcast whose clientId matches our own id (self-echo)', async () => {
    const mod = await reloadModule();
    mod.startTabsSync();
    // Wait for the initial fetchTabs() promise to resolve and set
    // hydrated=true.
    await Promise.resolve();
    await Promise.resolve();

    const api = (await import('../api/tabs.js')) as unknown as {
      __test_emit: (p: { tabs: { lawId: string; title: string }[]; clientId: string | null }) => void;
      __test_putTabs: ReturnType<typeof vi.fn>;
    };
    api.__test_putTabs.mockClear();
    api.__test_emit({
      tabs: [{ lawId: 'A', title: 'X' }],
      clientId: 'MY-CLIENT',
    });
    expect(mod.useTabs.getState().tabs).toEqual([]);
    expect(api.__test_putTabs).not.toHaveBeenCalled();
  });

  it('applies a broadcast from another client to local state', async () => {
    const mod = await reloadModule();
    mod.startTabsSync();
    // Let hydrate complete AND the hydrate-driven schedulePut debounce
    // (80 ms) fire before we start asserting on PUT calls.
    await new Promise((r) => setTimeout(r, 150));

    const api = (await import('../api/tabs.js')) as unknown as {
      __test_emit: (p: { tabs: { lawId: string; title: string }[]; clientId: string | null }) => void;
    };
    api.__test_emit({
      tabs: [{ lawId: 'B', title: '別端末' }],
      clientId: 'OTHER-CLIENT',
    });
    expect(mod.useTabs.getState().tabs).toEqual([
      { lawId: 'B', title: '別端末' },
    ]);
  });

  it('does NOT trigger a PUT when applying an SSE-driven update', async () => {
    const mod = await reloadModule();
    mod.startTabsSync();
    // Let hydrate complete AND the hydrate-driven schedulePut debounce
    // (80 ms) fire before we start asserting on PUT calls.
    await new Promise((r) => setTimeout(r, 150));

    const api = (await import('../api/tabs.js')) as unknown as {
      __test_emit: (p: { tabs: { lawId: string; title: string }[]; clientId: string | null }) => void;
      __test_putTabs: ReturnType<typeof vi.fn>;
    };
    api.__test_putTabs.mockClear();
    api.__test_emit({
      tabs: [{ lawId: 'C', title: 'C' }],
      clientId: 'OTHER-CLIENT',
    });
    // Allow the debounce window to fully expire — if the gate is broken,
    // a PUT will fire here.
    await new Promise((r) => setTimeout(r, 150));
    expect(api.__test_putTabs).not.toHaveBeenCalled();
  });

  it('a broadcast equal to current state is a no-op (no setState, no PUT)', async () => {
    const mod = await reloadModule();
    mod.useTabs.setState({ tabs: [{ lawId: 'X', title: 'X' }] });
    mod.startTabsSync();
    // Let hydrate complete AND the hydrate-driven schedulePut debounce
    // (80 ms) fire before we start asserting on PUT calls.
    await new Promise((r) => setTimeout(r, 150));

    const api = (await import('../api/tabs.js')) as unknown as {
      __test_emit: (p: { tabs: { lawId: string; title: string }[]; clientId: string | null }) => void;
      __test_putTabs: ReturnType<typeof vi.fn>;
    };
    api.__test_putTabs.mockClear();
    const before = mod.useTabs.getState().tabs;
    api.__test_emit({
      tabs: [{ lawId: 'X', title: 'X' }],
      clientId: 'OTHER-CLIENT',
    });
    // No replacement array — same reference means subscribe didn't fire.
    expect(mod.useTabs.getState().tabs).toBe(before);
    await new Promise((r) => setTimeout(r, 150));
    expect(api.__test_putTabs).not.toHaveBeenCalled();
  });
});
