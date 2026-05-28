import { performUpdateReload, useUpdate } from '../state/update.js';

/**
 * Shown when the X-App-Version observed from the server doesn't match the
 * one baked into this bundle. Clicking the button unregisters the active
 * SW and reloads, so the new code is in effect immediately.
 */
export function UpdateBanner() {
  const updateAvailable = useUpdate((s) => s.updateAvailable);
  const clientVersion = useUpdate((s) => s.clientVersion);
  const serverVersion = useUpdate((s) => s.serverVersion);

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      data-update-banner
      className="w-full bg-amber-100 dark:bg-amber-900/40 border-b border-amber-300 dark:border-amber-700 px-4 py-2 text-sm flex items-center gap-3"
    >
      <span aria-hidden="true">↻</span>
      <span className="text-amber-900 dark:text-amber-100">
        新しいバージョンが利用可能です
        <span className="ml-2 font-mono text-xs opacity-60">
          {clientVersion} → {serverVersion}
        </span>
      </span>
      <button
        type="button"
        onClick={() => { void performUpdateReload(); }}
        className="ml-auto px-3 py-1 rounded border border-amber-400 dark:border-amber-600 bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100"
      >
        リロード
      </button>
    </div>
  );
}
