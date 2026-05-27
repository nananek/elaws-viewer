import { resolve } from 'node:path';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { Mutex } from 'async-mutex';
import { getRealm } from './singleton.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const BACKUP_DIR = resolve(REPO_ROOT, 'storage', 'backups');
const KEEP_DAYS = 14;

const backupMutex = new Mutex();

function dateStamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // JST so the filename matches the user's local notion of "today"
  const jst = new Date(d.getTime() + 9 * 3600_000);
  return `${jst.getUTCFullYear()}${pad(jst.getUTCMonth() + 1)}${pad(jst.getUTCDate())}`;
}

/**
 * writeCopyTo storage/backups/annotations-YYYYMMDD.realm and prune older
 * snapshots, keeping only the most recent KEEP_DAYS files.
 */
export async function runDailyBackup(): Promise<string> {
  return backupMutex.runExclusive(async () => {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const realm = await getRealm();
    const file = `annotations-${dateStamp()}.realm`;
    const out = resolve(BACKUP_DIR, file);
    realm.writeCopyTo({ path: out });
    pruneOldBackups();
    return out;
  });
}

function pruneOldBackups(): void {
  const entries = readdirSync(BACKUP_DIR)
    .filter((f) => /^annotations-\d{8}\.realm(\.lock|\.management|\.note)?$/.test(f))
    .sort()
    .reverse();
  // Group by date prefix; keep the most recent KEEP_DAYS dates
  const seen = new Set<string>();
  for (const f of entries) {
    const m = f.match(/^annotations-(\d{8})\.realm/);
    if (!m) continue;
    seen.add(m[1]!);
    if (seen.size > KEEP_DAYS) {
      rmSync(resolve(BACKUP_DIR, f), { force: true });
    }
  }
}
