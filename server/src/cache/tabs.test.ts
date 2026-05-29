import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('user_tabs SQLite store', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = mkdtempSync(join(tmpdir(), 'elaws-tabs-test-'));
    process.env.ELAWS_DB_PATH = join(workDir, 'cache.db');
    // db.ts caches a singleton — closeDb() ensures the next getDb()
    // honours the freshly-set ELAWS_DB_PATH for this test.
    const { closeDb } = await import('./db.js');
    closeDb();
  });

  afterEach(async () => {
    const { closeDb } = await import('./db.js');
    closeDb();
    delete process.env.ELAWS_DB_PATH;
    rmSync(workDir, { recursive: true, force: true });
  });

  it('listTabs returns [] when nothing is stored', async () => {
    const { listTabs } = await import('./tabs.js');
    expect(listTabs()).toEqual([]);
  });

  it('replaceTabs persists tabs in given order and listTabs returns them', async () => {
    const { listTabs, replaceTabs } = await import('./tabs.js');
    replaceTabs([
      { lawId: 'LAW_A', title: '会社法' },
      { lawId: 'LAW_B', title: '民法' },
      { lawId: 'LAW_C', title: '憲法' },
    ]);
    expect(listTabs()).toEqual([
      { lawId: 'LAW_A', title: '会社法' },
      { lawId: 'LAW_B', title: '民法' },
      { lawId: 'LAW_C', title: '憲法' },
    ]);
  });

  it('replaceTabs is a full atomic replace (old rows go away)', async () => {
    const { listTabs, replaceTabs } = await import('./tabs.js');
    replaceTabs([
      { lawId: 'LAW_A', title: '民法' },
      { lawId: 'LAW_B', title: '会社法' },
    ]);
    replaceTabs([{ lawId: 'LAW_C', title: '憲法' }]);
    expect(listTabs()).toEqual([{ lawId: 'LAW_C', title: '憲法' }]);
  });

  it('replaceTabs([]) clears everything', async () => {
    const { listTabs, replaceTabs } = await import('./tabs.js');
    replaceTabs([{ lawId: 'LAW_A', title: '民法' }]);
    replaceTabs([]);
    expect(listTabs()).toEqual([]);
  });

  it('order_index is preserved even when titles repeat', async () => {
    const { listTabs, replaceTabs } = await import('./tabs.js');
    replaceTabs([
      { lawId: 'L1', title: '同名' },
      { lawId: 'L2', title: '同名' },
      { lawId: 'L3', title: '同名' },
    ]);
    expect(listTabs().map((t) => t.lawId)).toEqual(['L1', 'L2', 'L3']);
  });

  it('replaceTabs publishes a `tabs` change event with the right clientId', async () => {
    const { replaceTabs } = await import('./tabs.js');
    const events = await import('../events.js');
    type Ev = import('../events.js').ChangeEvent;
    const calls: Ev[] = [];
    const unsub = events.subscribeChanges((e) => calls.push(e));

    replaceTabs([{ lawId: 'A', title: '会社法' }], 'client-1');
    replaceTabs([{ lawId: 'B', title: '民法' }], 'client-2');

    expect(calls).toEqual([
      { resource: 'tabs', tabs: [{ lawId: 'A', title: '会社法' }], clientId: 'client-1' },
      { resource: 'tabs', tabs: [{ lawId: 'B', title: '民法' }], clientId: 'client-2' },
    ]);
    unsub();
  });
});
