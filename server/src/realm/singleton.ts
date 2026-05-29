import Realm from 'realm';
import { Mutex } from 'async-mutex';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ALL_SCHEMAS, SCHEMA_VERSION } from './schema.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const DEFAULT_STORAGE_DIR = resolve(REPO_ROOT, 'storage');
const DEFAULT_REALM_PATH = resolve(DEFAULT_STORAGE_DIR, 'annotations.realm');

let realm: Realm | null = null;
const writeMutex = new Mutex();

export async function getRealm(): Promise<Realm> {
  if (realm && !realm.isClosed) return realm;
  // Tests override the Realm file via `ELAWS_REALM_PATH=/tmp/...` so they
  // don't trample the dev / prod `storage/annotations.realm`.
  const realmPath = process.env.ELAWS_REALM_PATH ?? DEFAULT_REALM_PATH;
  const storageDir = resolve(realmPath, '..');
  mkdirSync(storageDir, { recursive: true });
  realm = await Realm.open({
    path: realmPath,
    schema: ALL_SCHEMAS,
    schemaVersion: SCHEMA_VERSION,
    // Defensive: if anyone bumps SCHEMA_VERSION in the future (matching a
    // real iOS schema change), a no-op `onMigration` lets Realm SDK proceed
    // for additive-only migrations without the user hitting:
    //   "Provided schema version N does not equal last set version M."
    // Adapt this body if a future bump needs data transfer.
    onMigration: () => {
      // additive-only by default; modify when a real migration is needed.
    },
  });
  return realm;
}

/**
 * Run a Realm write transaction with serialized access. All write callers
 * MUST use this helper — Realm itself does not serialize writes from
 * concurrent Promise chains, and clobbering would result.
 */
export async function withWrite<T>(fn: (r: Realm) => T): Promise<T> {
  const r = await getRealm();
  return writeMutex.runExclusive(() => {
    return r.write(() => fn(r));
  });
}

export async function closeRealm(): Promise<void> {
  if (realm && !realm.isClosed) {
    realm.close();
  }
  realm = null;
}

process.on('SIGINT', () => {
  closeRealm().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  closeRealm().finally(() => process.exit(0));
});
