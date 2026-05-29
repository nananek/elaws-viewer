import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  fetchTabs, putTabs, subscribeTabEvents, getClientId,
} from '../api/tabs.js';

export interface LawTab {
  lawId: string;
  title: string;
}

interface TabsState {
  tabs: LawTab[];
  /** true once we've hydrated from the server (or decided to skip). */
  hydrated: boolean;
  open: (tab: LawTab) => void;
  close: (lawId: string) => void;
  rename: (lawId: string, title: string) => void;
  move: (fromLawId: string, toIndex: number) => void;
}

export const useTabs = create<TabsState>()(
  persist(
    (set) => ({
      tabs: [],
      hydrated: false,
      open: (tab) =>
        set((s) => {
          const existing = s.tabs.find((t) => t.lawId === tab.lawId);
          if (existing) {
            // refresh title in case it changed
            return existing.title === tab.title
              ? s
              : {
                  tabs: s.tabs.map((t) =>
                    t.lawId === tab.lawId ? { ...t, title: tab.title } : t,
                  ),
                };
          }
          return { tabs: [...s.tabs, tab] };
        }),
      close: (lawId) =>
        set((s) => ({ tabs: s.tabs.filter((t) => t.lawId !== lawId) })),
      rename: (lawId, title) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.lawId === lawId ? { ...t, title } : t)),
        })),
      move: (fromLawId, toIndex) =>
        set((s) => {
          const from = s.tabs.findIndex((t) => t.lawId === fromLawId);
          if (from === -1) return s;
          const clampedTo = Math.max(0, Math.min(s.tabs.length - 1, toIndex));
          if (from === clampedTo) return s;
          const next = s.tabs.slice();
          const [moved] = next.splice(from, 1);
          next.splice(clampedTo, 0, moved!);
          return { tabs: next };
        }),
    }),
    {
      name: 'elaws.tabs',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // `hydrated` is per-session — never restore it from storage. Tabs
      // themselves survive across reloads as the offline cache.
      partialize: (s) => ({ tabs: s.tabs }) as Partial<TabsState>,
    },
  ),
);

/* ---------- Server sync ----------
 *
 * Model: SQLite on the server is source of truth, localStorage is an
 * offline cache. Last-writer-wins ([[user-role]] — single user, single
 * device at a time).
 *
 *  1. Cold start: fetch /api/tabs. Replace local state with server's.
 *  2. Any mutation after hydrate: debounced PUT /api/tabs (full replace).
 *  3. Server unreachable: skip; localStorage cache still drives the UI.
 *
 * Why debounced PUT: open/close/move can fire 3–4 times in a second
 * (drag-and-drop reorder). One PUT per "settled" state keeps the
 * server's `updated_at` meaningful.
 */

// Short enough that tests don't need explicit waits, long enough to
// coalesce the 3–4 setState calls a drag-reorder fires in ~16ms each.
const PUT_DEBOUNCE_MS = 80;
let pendingPutTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * When an SSE update is being applied to the store, we suppress the
 * resulting subscribe callback from firing a PUT. Without this guard
 * a → b → server-broadcast → b → PUT(b) → broadcast → a → PUT(a) → … loop
 * is possible. Even with same-content guards a redundant PUT per peer
 * per change would waste a round-trip.
 */
let applyingSseUpdate = false;

function flushPut(): void {
  if (pendingPutTimer == null) return;
  clearTimeout(pendingPutTimer);
  pendingPutTimer = null;
  putTabs(useTabs.getState().tabs).catch((e) => {
    console.warn('[tabs] PUT /api/tabs failed:', e);
  });
}

function schedulePut(tabs: LawTab[]): void {
  if (pendingPutTimer) clearTimeout(pendingPutTimer);
  pendingPutTimer = setTimeout(() => {
    pendingPutTimer = null;
    putTabs(tabs).catch((e) => {
      console.warn('[tabs] PUT /api/tabs failed:', e);
    });
  }, PUT_DEBOUNCE_MS);
}

let syncStarted = false;

/** Wire up server sync. Call once during app bootstrap. */
export function startTabsSync(): void {
  if (syncStarted) return;
  syncStarted = true;

  // Tests opt out by setting this on window before bootstrap.
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __ELAWS_DISABLE_TABS_SYNC__?: boolean })
      .__ELAWS_DISABLE_TABS_SYNC__
  ) {
    useTabs.setState({ hydrated: true });
    return;
  }

  void fetchTabs()
    .then(({ tabs: serverTabs }) => {
      // Hydrate via MERGE, not replace. Why:
      //   * On a cold start the persist middleware has already restored
      //     localStorage tabs into `state.tabs`. Some of those may not
      //     have been synced yet (debounced PUT was killed by an unload).
      //   * The server's `[]` does NOT mean "user closed everything" —
      //     it can also mean "the previous PUT raced page unload".
      //     Replacing local with server would silently lose tabs.
      // Trade-off: closing a tab on device A doesn't propagate to
      // device B's stale local cache until device B opens or closes
      // any other tab (which triggers a full PUT and re-syncs server
      // state). For single-user single-device-at-a-time usage that's
      // acceptable ([[user-role]]).
      const local = useTabs.getState().tabs;
      const seen = new Set(serverTabs.map((t) => t.lawId));
      const localOnly = local.filter((t) => !seen.has(t.lawId));
      const merged = [...serverTabs, ...localOnly];
      useTabs.setState({ tabs: merged, hydrated: true });
    })
    .catch((e) => {
      // Offline — keep whatever persist restored from localStorage.
      console.warn('[tabs] hydrate from server failed:', e);
      useTabs.setState({ hydrated: true });
    });

  useTabs.subscribe((state, prev) => {
    if (!state.hydrated) return;
    if (state.tabs === prev.tabs) return;
    if (applyingSseUpdate) return;
    schedulePut(state.tabs);
  });

  // Force any pending debounced PUT out the door before the page unloads
  // (e.g. browser tab close, hard navigation). `keepalive: true` on the
  // underlying fetch keeps the request alive past unload.
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPut);
  }

  // Real-time multi-session sync. Other devices' PUTs come in here.
  // We trust the broadcasted list and replace local state with it,
  // suppressing our own echoes by clientId comparison.
  const myId = getClientId();
  subscribeTabEvents((change) => {
    if (change.clientId === myId) return; // self-echo, ignore
    const current = useTabs.getState().tabs;
    // No-op when the server's view already matches what we have (the
    // initial snapshot after our own PUT is the common case).
    if (sameTabs(current, change.tabs)) return;
    applyingSseUpdate = true;
    try {
      useTabs.setState({ tabs: change.tabs });
    } finally {
      applyingSseUpdate = false;
    }
  });
}

function sameTabs(a: { lawId: string; title: string }[], b: { lawId: string; title: string }[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.lawId !== b[i]!.lawId || a[i]!.title !== b[i]!.title) return false;
  }
  return true;
}
