import Realm from 'realm';
import { Mutex } from 'async-mutex';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { getRealm, withWrite } from './singleton.js';
import { ALL_SCHEMAS, SCHEMA_VERSION } from './schema.js';

const exportMutex = new Mutex();

/**
 * Produce a compacted copy of the live Realm to a temp file and return
 * the raw bytes. The caller is responsible for cleanup.
 */
export async function exportRealmBytes(): Promise<Buffer> {
  return exportMutex.runExclusive(async () => {
    const realm = await getRealm();
    const dir = mkdtempSync(resolve(tmpdir(), 'elaws-export-'));
    const out = resolve(dir, 'export.realm');
    try {
      realm.writeCopyTo({ path: out });
      const bytes = readFileSync(out);
      return bytes;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

export interface MergeStats {
  selections: { created: number; updated: number; skipped: number };
  bookmarks: { created: number; updated: number; skipped: number };
  tags: { created: number; updated: number; skipped: number };
  tagEntities: { updated: number };
  downloads: { created: number; updated: number; skipped: number };
  organizables: { created: number; updated: number; skipped: number };
  errors: string[];
}

/**
 * Merge another `.realm` file into the live one. Strategy per primary key:
 *  - If primary key not present here: create
 *  - If present and the incoming row's `updatedAt` is newer: update
 *  - Otherwise: skip
 * For TagEntity (no updatedAt), incoming title always overwrites if changed.
 */
export async function importRealmBytes(bytes: Buffer): Promise<MergeStats> {
  return exportMutex.runExclusive(async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'elaws-import-'));
    const tmpPath = resolve(dir, 'incoming.realm');
    writeFileSync(tmpPath, bytes);

    const stats: MergeStats = {
      selections: { created: 0, updated: 0, skipped: 0 },
      bookmarks: { created: 0, updated: 0, skipped: 0 },
      tags: { created: 0, updated: 0, skipped: 0 },
      tagEntities: { updated: 0 },
      downloads: { created: 0, updated: 0, skipped: 0 },
      organizables: { created: 0, updated: 0, skipped: 0 },
      errors: [],
    };

    let src: Realm | null = null;
    try {
      src = await Realm.open({
        path: tmpPath,
        schema: ALL_SCHEMAS,
        schemaVersion: SCHEMA_VERSION,
        readOnly: true,
      });
      const incoming = src;

      await withWrite((realm) => {
        // SelectionObject
        for (const s of incoming.objects('SelectionObject')) {
          mergeByUuidWithDate(realm, 'SelectionObject', s as unknown as DatedRow, stats.selections);
        }
        for (const s of incoming.objects('Bookmark')) {
          mergeByUuidWithDate(realm, 'Bookmark', s as unknown as DatedRow, stats.bookmarks);
        }
        for (const s of incoming.objects('Tag')) {
          mergeByUuidNoDate(realm, 'Tag', s as unknown as UuidRow, stats.tags);
        }
        for (const t of incoming.objects('TagEntity')) {
          const row = t as unknown as TagEntityRow;
          const existing = realm.objects('TagEntity').filtered('tagNumber == $0', row.tagNumber);
          if (existing.length === 0) {
            realm.create('TagEntity', cloneObject(row));
            stats.tagEntities.updated++;
          } else {
            const e = existing[0] as unknown as TagEntityRow;
            if (e.title !== row.title || e.order !== row.order || e.colorType !== row.colorType || e.isDeleted !== row.isDeleted) {
              e.title = row.title;
              e.order = row.order;
              e.colorType = row.colorType;
              e.isDeleted = row.isDeleted;
              stats.tagEntities.updated++;
            }
          }
        }
        for (const s of incoming.objects('DownloadedLaw')) {
          mergeByUuidWithDate(realm, 'DownloadedLaw', s as unknown as DatedRow, stats.downloads);
        }
        for (const s of incoming.objects('Organizable')) {
          mergeByUuidWithDate(realm, 'Organizable', s as unknown as DatedRow, stats.organizables);
        }
      });
    } catch (e) {
      stats.errors.push(String(e));
    } finally {
      if (src) src.close();
      rmSync(dir, { recursive: true, force: true });
    }
    return stats;
  });
}

type UuidRow = { uuid: string } & Record<string, unknown>;
type DatedRow = UuidRow & { updatedAt: Date };
type TagEntityRow = { tagNumber: number; title: string; order: number; colorType: number; isDeleted: boolean } & Record<string, unknown>;

function mergeByUuidWithDate(
  realm: Realm,
  className: string,
  incoming: DatedRow,
  bucket: { created: number; updated: number; skipped: number },
): void {
  const existing = realm.objects(className).filtered('uuid == $0', incoming.uuid);
  if (existing.length === 0) {
    realm.create(className, cloneObject(incoming));
    bucket.created++;
    return;
  }
  const e = existing[0] as unknown as DatedRow;
  if (e.updatedAt && incoming.updatedAt && e.updatedAt >= incoming.updatedAt) {
    bucket.skipped++;
    return;
  }
  for (const [k, v] of Object.entries(cloneObject(incoming))) {
    if (k === 'uuid') continue;
    (e as Record<string, unknown>)[k] = v;
  }
  bucket.updated++;
}

function mergeByUuidNoDate(
  realm: Realm,
  className: string,
  incoming: UuidRow,
  bucket: { created: number; updated: number; skipped: number },
): void {
  const existing = realm.objects(className).filtered('uuid == $0', incoming.uuid);
  if (existing.length === 0) {
    realm.create(className, cloneObject(incoming));
    bucket.created++;
    return;
  }
  bucket.skipped++;
}

function cloneObject<T extends Record<string, unknown>>(o: T): T {
  const plain: Record<string, unknown> = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v instanceof Date) plain[k] = new Date(v.getTime());
    else if (v instanceof ArrayBuffer) plain[k] = v.slice(0);
    else plain[k] = v;
  }
  return plain as T;
}

void existsSync;
