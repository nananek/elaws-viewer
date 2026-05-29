import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Realm from 'realm';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeRealm, getRealm, withWrite } from './singleton.js';
import { exportRealmBytes, importRealmBytes } from './export.js';
import { createSelection } from './selections-write.js';
import { upsertDownloadedLaw } from './downloads-write.js';

/**
 * Real-Realm round-trip test for the settings export/import feature
 * (`GET /api/export/realm` → exportRealmBytes, `POST /api/import/realm`
 * → importRealmBytes). The Settings-page e2e (phase10-pr-c.spec.ts) mocks
 * the import endpoint, so the actual `writeCopyTo` export and the
 * uuid×updatedAt merge logic were previously never exercised.
 *
 * Strategy: seed a known dataset into Realm A, export it to bytes, then
 * import those bytes into a *fresh empty* Realm B and assert B === A. The
 * singleton reads `ELAWS_REALM_PATH` at open time and `closeRealm()` drops
 * the cached handle, so we can point export and import at different files.
 */

let workDir = '';
let realmAPath = '';
let exported: Buffer;
let seedSelUuid = '';
let seedDlUuid = '';
let seedUpdatedAt = 0;

const SEED_COUNTS = {
  SelectionObject: 2,
  Bookmark: 1,
  Tag: 1,
  TagEntity: 1,
  DownloadedLaw: 1,
  Organizable: 1,
} as const;

async function useRealm(path: string): Promise<Realm> {
  await closeRealm();
  process.env.ELAWS_REALM_PATH = path;
  return getRealm();
}

function countNonDeletable(realm: Realm, cls: string): number {
  return realm.objects(cls).length;
}

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'elaws-export-test-'));
  realmAPath = join(workDir, 'a.realm');
  await useRealm(realmAPath);

  // --- seed Realm A across every class importRealmBytes merges ---
  seedSelUuid = await createSelection({
    lawNo: '明治二十九年法律第八十九号',
    style: 0,
    row: 10,
    startIndexInRow: 0,
    startAnchor: '条400/項1/文1',
    endAnchor: '条400/項1/文1',
    startString: '善良な管理者の注意',
    startStringOccurrenceIndex: 0,
    notes: 'round-trip me',
  });
  // second selection on a distinct anchor so overlap-pruning can't soft-delete it
  await createSelection({
    lawNo: '明治二十九年法律第八十九号',
    style: 5,
    row: 20,
    startIndexInRow: 3,
    startAnchor: '条415/項1/文1',
    endAnchor: '条415/項1/文1',
    startString: '債務の本旨',
    startStringOccurrenceIndex: 0,
  });
  seedDlUuid = await upsertDownloadedLaw({
    lawNum: '明治二十九年法律第八十九号',
    lawTitle: '民法',
    lawEdition: 'roundtrip-edition',
    filename: '129AC0000000089_20260401_506AC0000000033',
  });

  await withWrite((realm) => {
    const now = new Date();
    realm.create('Bookmark', {
      uuid: 'bm-roundtrip-0000000000',
      filepath: '/',
      order: 0,
      title: '善管注意義務',
      lawNo: '明治二十九年法律第八十九号',
      anchor: '条400/頭',
      row: 10,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
    realm.create('Tag', {
      uuid: 'tag-roundtrip-000000000',
      lawNo: '明治二十九年法律第八十九号',
      anchor: '条400/項1/文1',
      tagNumber: 3,
      isDeleted: false,
    });
    realm.create('TagEntity', {
      tagNumber: 3,
      order: 3,
      title: '重要',
      colorType: 3,
      isDeleted: false,
    });
    realm.create('Organizable', {
      uuid: 'org-roundtrip-000000000',
      filepath: '/',
      order: 1,
      title: 'マイ六法',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });
  });

  // Record the seeded selection's updatedAt for the merge-strategy test.
  const realmA = await getRealm();
  const sel = realmA
    .objects<{ uuid: string; updatedAt: Date }>('SelectionObject')
    .filtered('uuid == $0', seedSelUuid)[0]!;
  seedUpdatedAt = sel.updatedAt.getTime();

  // Sanity: A holds what we seeded.
  for (const [cls, n] of Object.entries(SEED_COUNTS)) {
    expect(countNonDeletable(realmA, cls), `seed count ${cls}`).toBe(n);
  }

  exported = await exportRealmBytes();
});

afterAll(async () => {
  await closeRealm();
  if (workDir) rmSync(workDir, { recursive: true, force: true });
  delete process.env.ELAWS_REALM_PATH;
});

describe('Realm export/import round-trip', () => {
  it('exportRealmBytes produces a re-openable Realm file', () => {
    expect(exported.length).toBeGreaterThan(100);
    // Realm/TightDB magic "T-DB" sits at byte offset 0x10.
    expect(exported.subarray(0x10, 0x10 + 4).toString('latin1')).toBe('T-DB');
  });

  it('importing into an empty Realm recreates every seeded row with identical content', async () => {
    const bPath = join(workDir, 'b-create.realm');
    await useRealm(bPath); // fresh empty file

    const stats = await importRealmBytes(exported);

    expect(stats.errors).toEqual([]);
    expect(stats.selections).toEqual({ created: 2, updated: 0, skipped: 0 });
    expect(stats.bookmarks).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(stats.tags).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(stats.tagEntities).toEqual({ updated: 1 });
    expect(stats.downloads).toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(stats.organizables).toEqual({ created: 1, updated: 0, skipped: 0 });

    const realmB = await getRealm();
    for (const [cls, n] of Object.entries(SEED_COUNTS)) {
      expect(countNonDeletable(realmB, cls), `imported count ${cls}`).toBe(n);
    }

    // Content fidelity, not just row counts.
    const sel = realmB
      .objects<{ startString: string; notes: string | null; style: number; updatedAt: Date }>(
        'SelectionObject',
      )
      .filtered('uuid == $0', seedSelUuid)[0]!;
    expect(sel.startString).toBe('善良な管理者の注意');
    expect(sel.notes).toBe('round-trip me');
    expect(sel.style).toBe(0);
    expect(sel.updatedAt.getTime()).toBe(seedUpdatedAt);

    const dl = realmB
      .objects<{ lawTitle: string; lawEdition: string }>('DownloadedLaw')
      .filtered('uuid == $0', seedDlUuid)[0]!;
    expect(dl.lawTitle).toBe('民法');
    expect(dl.lawEdition).toBe('roundtrip-edition');

    const tag = realmB.objects<{ tagNumber: number }>('Tag')[0]!;
    expect(tag.tagNumber).toBe(3);
    const te = realmB.objects<{ title: string }>('TagEntity')[0]!;
    expect(te.title).toBe('重要');
  });

  it('re-importing the same bytes is idempotent (all skipped, no duplicates)', async () => {
    const bPath = join(workDir, 'b-idempotent.realm');
    await useRealm(bPath);

    await importRealmBytes(exported); // populate
    const second = await importRealmBytes(exported); // re-import

    expect(second.errors).toEqual([]);
    expect(second.selections).toEqual({ created: 0, updated: 0, skipped: 2 });
    expect(second.bookmarks).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(second.tags).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(second.downloads).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(second.organizables).toEqual({ created: 0, updated: 0, skipped: 1 });
    // TagEntity has no updatedAt — unchanged title means no overwrite.
    expect(second.tagEntities).toEqual({ updated: 0 });

    const realmB = await getRealm();
    for (const [cls, n] of Object.entries(SEED_COUNTS)) {
      expect(countNonDeletable(realmB, cls), `no dupes ${cls}`).toBe(n);
    }
  });

  it('merge favors the newer updatedAt: stale local row is overwritten, fresher local row is kept', async () => {
    const bPath = join(workDir, 'b-merge.realm');
    await useRealm(bPath);
    await importRealmBytes(exported); // populate B == A

    const realmB = await getRealm();

    // Make the local selection OLDER than the incoming copy and corrupt a
    // field — the next import should overwrite it back to A's value.
    await withWrite((realm) => {
      const s = realm
        .objects<{ uuid: string; startString: string; updatedAt: Date }>('SelectionObject')
        .filtered('uuid == $0', seedSelUuid)[0]! as unknown as {
        startString: string;
        updatedAt: Date;
      };
      s.startString = 'STALE LOCAL EDIT';
      s.updatedAt = new Date(seedUpdatedAt - 60_000);
    });

    // Make the DownloadedLaw NEWER than incoming and change a field — the
    // next import must NOT clobber it.
    await withWrite((realm) => {
      const d = realm
        .objects<{ uuid: string; lawTitle: string; updatedAt: Date }>('DownloadedLaw')
        .filtered('uuid == $0', seedDlUuid)[0]! as unknown as {
        lawTitle: string;
        updatedAt: Date;
      };
      d.lawTitle = '民法（ローカル新版）';
      d.updatedAt = new Date(seedUpdatedAt + 60_000);
    });

    const merge = await importRealmBytes(exported);
    expect(merge.errors).toEqual([]);
    expect(merge.selections.updated).toBe(1); // stale one refreshed
    expect(merge.selections.skipped).toBe(1); // the other untouched
    expect(merge.downloads).toEqual({ created: 0, updated: 0, skipped: 1 });

    const sel = realmB
      .objects<{ startString: string }>('SelectionObject')
      .filtered('uuid == $0', seedSelUuid)[0]!;
    expect(sel.startString).toBe('善良な管理者の注意'); // restored from import

    const dl = realmB
      .objects<{ lawTitle: string }>('DownloadedLaw')
      .filtered('uuid == $0', seedDlUuid)[0]!;
    expect(dl.lawTitle).toBe('民法（ローカル新版）'); // local fresher copy kept
  });
});
