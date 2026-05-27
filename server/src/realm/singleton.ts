import Realm from 'realm';
import { Mutex } from 'async-mutex';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ALL_SCHEMAS, SCHEMA_VERSION } from './schema.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const STORAGE_DIR = resolve(REPO_ROOT, 'storage');
const REALM_PATH = resolve(STORAGE_DIR, 'annotations.realm');

let realm: Realm | null = null;
const writeMutex = new Mutex();

export async function getRealm(): Promise<Realm> {
  if (realm && !realm.isClosed) return realm;
  mkdirSync(STORAGE_DIR, { recursive: true });
  realm = await Realm.open({
    path: REALM_PATH,
    schema: ALL_SCHEMAS,
    schemaVersion: SCHEMA_VERSION,
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
