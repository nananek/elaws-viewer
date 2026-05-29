import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Realm from 'realm';
import { mkdtempSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { ALL_SCHEMAS, SCHEMA_VERSION } from './schema.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const CATALYSTWO_DUMP = resolve(
  REPO_ROOT,
  '法令ブラウザデータ.comcatalystwoelawslawxml',
);

// The Catalystwo dump is gitignored personal data — skip the test cleanly
// when it isn't present (CI, contributors without the dump).
const hasDump = existsSync(CATALYSTWO_DUMP);
const describeIfDump = hasDump ? describe : describe.skip;

describeIfDump('folders module against Catalystwo realm dump', () => {
  let workDir: string;
  let realmPath: string;
  let realm: Realm;

  beforeAll(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'elaws-folders-test-'));
    realmPath = join(workDir, 'annotations.realm');
    copyFileSync(CATALYSTWO_DUMP, realmPath);
    realm = await Realm.open({
      path: realmPath,
      schema: ALL_SCHEMAS,
      schemaVersion: SCHEMA_VERSION,
      onMigration: () => {},
    });
  });

  afterAll(() => {
    if (realm && !realm.isClosed) realm.close();
    rmSync(workDir, { recursive: true, force: true });
  });

  it('opens the dump at SCHEMA_VERSION 23 with no migration', () => {
    expect(realm.schemaVersion).toBe(23);
    expect(SCHEMA_VERSION).toBe(23);
  });

  it('does NOT contain a FolderEntity class — folders live in Organizable', () => {
    const classes = realm.schema.map((c) => c.name);
    expect(classes).not.toContain('FolderEntity');
    expect(classes).toContain('Organizable');
  });

  it('Catalystwo dump has the expected 5 top-level Organizable folders', () => {
    const live = realm
      .objects<{ uuid: string; title: string; filepath: string }>(
        'Organizable',
      )
      .filtered('isDeleted == false');
    const titles = Array.from(live).map((o) => o.title).sort();
    expect(titles).toEqual(
      ['マイ六法', '労働法', '知的財産権法', '税法', '道路交通法'].sort(),
    );
    for (const o of live) {
      expect(o.filepath).toBe('/'); // all 5 are root-level in this dump
    }
  });

  it('DownloadedLaw filepath references match an Organizable uuid (where folder-tracked)', () => {
    const orgUuids = new Set(
      Array.from(
        realm.objects<{ uuid: string }>('Organizable').filtered('isDeleted == false'),
      ).map((o) => o.uuid),
    );
    // 47 total laws; some live at root `/`, some directly under a folder
    // `/{org-uuid}/`, some under a nested law `/{org-uuid}/{law-uuid}/`.
    const laws = Array.from(
      realm
        .objects<{ filepath: string; lawTitle: string }>('DownloadedLaw')
        .filtered('isDeleted == false'),
    );
    expect(laws.length).toBe(47);

    // Every non-root filepath's first UUID segment is a known Organizable uuid.
    let orgRefs = 0;
    for (const l of laws) {
      if (l.filepath === '/') continue;
      const segs = l.filepath.replace(/^\/+|\/+$/g, '').split('/');
      expect(segs.length).toBeGreaterThanOrEqual(1);
      expect(orgUuids).toContain(segs[0]!); // first segment = Organizable
      orgRefs++;
    }
    expect(orgRefs).toBeGreaterThan(0);
  });
});
