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

  it('subscribeTabs delivers replaceTabs events to every listener with the right clientId', async () => {
    const { replaceTabs, subscribeTabs } = await import('./tabs.js');
    const calls1: import('./tabs.js').TabsChange[] = [];
    const calls2: import('./tabs.js').TabsChange[] = [];
    const unsub1 = subscribeTabs((c) => calls1.push(c));
    const unsub2 = subscribeTabs((c) => calls2.push(c));

    replaceTabs([{ lawId: 'A', title: '会社法' }], 'client-1');
    replaceTabs([{ lawId: 'B', title: '民法' }], 'client-2');

    expect(calls1).toEqual([
      { tabs: [{ lawId: 'A', title: '会社法' }], clientId: 'client-1' },
      { tabs: [{ lawId: 'B', title: '民法' }], clientId: 'client-2' },
    ]);
    expect(calls2).toEqual(calls1);

    unsub1();
    replaceTabs([{ lawId: 'C', title: '憲法' }], 'client-3');
    expect(calls1).toHaveLength(2); // unsubscribed — no further events
    expect(calls2).toHaveLength(3);
    unsub2();
  });

  it('a listener that throws does not stop other listeners or break the SQL commit', async () => {
    const { listTabs, replaceTabs, subscribeTabs } = await import('./tabs.js');
    const survived: import('./tabs.js').TabsChange[] = [];
    const unsubBad = subscribeTabs(() => {
      throw new Error('boom');
    });
    const unsubGood = subscribeTabs((c) => survived.push(c));

    expect(() =>
      replaceTabs([{ lawId: 'A', title: 'X' }], 'caller'),
    ).not.toThrow();

    expect(survived).toHaveLength(1);
    // SQL state must be intact even though one subscriber threw
    expect(listTabs()).toEqual([{ lawId: 'A', title: 'X' }]);
    unsubBad();
    unsubGood();
  });
});
