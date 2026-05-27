import { runDailyBackup } from './backup.js';

const JST_OFFSET_MS = 9 * 3600_000;

function msUntilNext0300JST(now = new Date()): number {
  // Compute the next 03:00 JST (UTC 18:00 the previous day).
  // Work in JST by shifting now into a "virtual UTC clock":
  const nowJst = now.getTime() + JST_OFFSET_MS;
  const d = new Date(nowJst);
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3, 0, 0, 0),
  );
  if (target.getTime() <= nowJst) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - nowJst;
}

let timer: NodeJS.Timeout | null = null;

export function startBackupScheduler(): void {
  if (timer) return;
  const arm = () => {
    const delay = msUntilNext0300JST();
    timer = setTimeout(async () => {
      try {
        const out = await runDailyBackup();
        console.log(`[backup] wrote ${out}`);
      } catch (e) {
        console.error('[backup] failed', e);
      } finally {
        arm();
      }
    }, delay);
    // Allow the process to exit naturally on SIGTERM without waiting on us
    timer.unref?.();
  };
  arm();
  console.log(
    `[backup] scheduler armed — first run in ${Math.round(
      msUntilNext0300JST() / 60_000,
    )} min`,
  );
}
