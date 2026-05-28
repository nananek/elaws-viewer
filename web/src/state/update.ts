import { create } from 'zustand';
import { APP_VERSION } from '../version.js';

interface UpdateState {
  /** Version embedded into this bundle at build time. */
  clientVersion: string;
  /** Most recent X-App-Version observed from the server. */
  serverVersion: string | null;
  /** True iff server reports a version different from ours. */
  updateAvailable: boolean;
  /** Called by the fetch wrapper on every /api response. */
  observeServerVersion: (version: string | null) => void;
}

export const useUpdate = create<UpdateState>((set, get) => ({
  clientVersion: APP_VERSION,
  serverVersion: null,
  updateAvailable: false,
  observeServerVersion: (version) => {
    if (!version) return;
    const { clientVersion, serverVersion } = get();
    if (version === serverVersion) return; // no change since last observation
    set({
      serverVersion: version,
      // Never flag a mismatch when either side is unidentified ("dev").
      // Otherwise the dev workflow (hot-reload server vs built web) would
      // spam the banner constantly.
      updateAvailable:
        version !== clientVersion && version !== 'dev' && clientVersion !== 'dev',
    });
  },
}));

/** Imperative reload helper used by the banner button. Ensures the next
 *  page load picks up the freshly fetched SW + bundle. */
export async function performUpdateReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        try { await reg.update(); } catch { /* ignore */ }
        try { await reg.unregister(); } catch { /* ignore */ }
      }
    }
  } finally {
    window.location.reload();
  }
}
