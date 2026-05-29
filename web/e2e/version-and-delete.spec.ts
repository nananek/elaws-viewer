import { expect, test } from '@playwright/test';
import {
  LAW_ID, LAW_NUM, LAW_TITLE,
  createMockState, installApiMocks,
} from './fixtures.js';

test.describe('Version status badge', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('現行最新: single revision of a lawNum gets the 現行最新 badge', async ({ page }) => {
    // The default LAW_ID = "TESTLAW1" has no embedded date; use a date-style
    // filename so the badge logic finds an enforcement date.
    const currentRevFilename = `${LAW_ID}_20260401_000000000000000`;
    await page.route('**/api/laws', (r) =>
      r.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          count: 1,
          laws: [{
            uuid: 'u-1', lawTitle: LAW_TITLE, lawNum: LAW_NUM,
            filename: currentRevFilename, lawEdition: '', mishikoLawNum: '',
            filepath: '/', order: 50, title: '',
            isDeleted: false,
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
          }],
        }),
      }),
    );
    // Route the body endpoint for this synthetic filename
    await page.route(`**/api/laws/${encodeURIComponent(currentRevFilename)}/body`, (r) =>
      r.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lawId: currentRevFilename, lawNum: LAW_NUM, lawTitle: LAW_TITLE,
          enforcementDate: '2026-04-01',
          nodes: [{ anchor: '条1/頭', row: 1, kind: 'articleTitle', text: '第一条' }],
        }),
      }),
    );

    await page.goto(`/law/${currentRevFilename}`);
    const badge = page.getByTestId('revision-status-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('data-revision-status', 'current');
    await expect(badge).toHaveText('現行最新');
  });

  test('過去法: an older revision when a newer in-force sibling exists', async ({ page }) => {
    const older = `${LAW_ID}_20200101_aaa`;
    const newer = `${LAW_ID}_20260401_bbb`;
    await page.route('**/api/laws', (r) =>
      r.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          count: 2,
          laws: [older, newer].map((fn, i) => ({
            uuid: `u-${i}`, lawTitle: LAW_TITLE, lawNum: LAW_NUM,
            filename: fn, lawEdition: '', mishikoLawNum: '',
            filepath: '/', order: 50, title: '',
            isDeleted: false,
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
          })),
        }),
      }),
    );
    for (const fn of [older, newer]) {
      await page.route(`**/api/laws/${encodeURIComponent(fn)}/body`, (r) =>
        r.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            lawId: fn, lawNum: LAW_NUM, lawTitle: LAW_TITLE,
            enforcementDate: null,
            nodes: [{ anchor: '条1/頭', row: 1, kind: 'articleTitle', text: '第一条' }],
          }),
        }),
      );
    }

    // Load the older revision → expect 過去法
    await page.goto(`/law/${older}`);
    const badge = page.getByTestId('revision-status-badge');
    await expect(badge).toHaveAttribute('data-revision-status', 'past');
    await expect(badge).toHaveText('過去法');
  });

  test('未施行: a future 施行日 yields the 未施行 badge', async ({ page }) => {
    const future = `${LAW_ID}_20300101_xxx`;
    await page.route('**/api/laws', (r) =>
      r.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          count: 1,
          laws: [{
            uuid: 'u-1', lawTitle: LAW_TITLE, lawNum: LAW_NUM,
            filename: future, lawEdition: '', mishikoLawNum: '',
            filepath: '/', order: 50, title: '',
            isDeleted: false,
            createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
          }],
        }),
      }),
    );
    await page.route(`**/api/laws/${encodeURIComponent(future)}/body`, (r) =>
      r.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lawId: future, lawNum: LAW_NUM, lawTitle: LAW_TITLE,
          enforcementDate: '2030-01-01',
          nodes: [{ anchor: '条1/頭', row: 1, kind: 'articleTitle', text: '第一条' }],
        }),
      }),
    );

    await page.goto(`/law/${future}`);
    const badge = page.getByTestId('revision-status-badge');
    await expect(badge).toHaveAttribute('data-revision-status', 'future');
    await expect(badge).toHaveText('未施行');
  });
});

test.describe('AddLawModal — 現行最新 default + 他の版 disclosure', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
    // Mock e-Gov search to return one hit
    await page.route('**/api/laws/search*', (r) =>
      r.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          total_count: 1, count: 1, next_offset: 0,
          laws: [{
            law_info: { law_id: '129AC0000000089', law_num: '明治二十九年法律第八十九号' },
            revision_info: {
              law_title: '民法',
              law_revision_id: '129AC0000000089_20260401_506AC0000000033',
              amendment_enforcement_date: '2026-04-01',
            },
          }],
        }),
      }),
    );
    await page.route('**/api/laws/revisions/*', (r) =>
      r.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          total_count: 2, count: 2, next_offset: 0,
          laws: [
            { law_info: { law_id: '129AC0000000089', law_num: '明治二十九年法律第八十九号' },
              revision_info: { law_title: '民法',
                law_revision_id: '129AC0000000089_20260401_x', amendment_enforcement_date: '2026-04-01' }},
            { law_info: { law_id: '129AC0000000089', law_num: '明治二十九年法律第八十九号' },
              revision_info: { law_title: '民法',
                law_revision_id: '129AC0000000089_20240524_y', amendment_enforcement_date: '2024-05-24' }},
          ],
        }),
      }),
    );
  });

  test('search result shows 「現行最新を追加」 as the primary button', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('add-law-button').click();
    await page.getByTestId('add-law-search-input').fill('民法');
    await page.getByTestId('add-law-hit').first().waitFor();

    // Primary action is one-click「現行最新を追加」
    const addCurrent = page.getByTestId('add-law-add-current');
    await expect(addCurrent).toBeVisible();
    await expect(addCurrent).toHaveText('現行最新を追加');

    // The previous「ダウンロード」label must be gone
    await expect(page.getByRole('button', { name: 'ダウンロード' })).toHaveCount(0);
  });

  test('「他の版を見る」 expands the revision picker; revision list shows 「この版を追加」', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('add-law-button').click();
    await page.getByTestId('add-law-search-input').fill('民法');
    await page.getByTestId('add-law-hit').first().waitFor();

    const disclosure = page.getByTestId('add-law-other-revisions');
    await expect(disclosure).toBeVisible();
    await expect(disclosure).toHaveText('他の版を見る');
    await disclosure.click();

    const revisions = page.getByTestId('add-law-revision');
    await expect(revisions.first()).toBeVisible();
    await expect(revisions).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'この版を追加' }).first()).toBeVisible();
  });
});

test.describe('FolderTree — per-law delete', () => {
  const lawFilename = '335AC0000000105_20250601_xxx';
  const lawTitle = '道路交通法';
  const lawNum = '昭和三十五年法律第百五号';

  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
    let deleted = false;
    await page.route('**/api/laws', (r) => {
      if (r.request().method() !== 'GET') return r.continue();
      r.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          count: deleted ? 0 : 1,
          laws: deleted ? [] : [{
            uuid: 'u-1', lawTitle, lawNum, filename: lawFilename,
            lawEdition: '', mishikoLawNum: '', filepath: '/', order: 50, title: '',
            isDeleted: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }],
        }),
      });
    });
    await page.route(`**/api/laws/${encodeURIComponent(lawFilename)}`, (r) => {
      if (r.request().method() === 'DELETE') {
        deleted = true;
        return r.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ok: true, lawId: lawFilename }),
        });
      }
      return r.continue();
    });
  });

  test('hover reveals 削除 button, confirmation removes the law from the tree', async ({ page }) => {
    await page.goto('/');
    const lawRow = page.getByTestId('folder-tree-law').filter({ hasText: lawTitle });
    await expect(lawRow).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await lawRow.getByTestId('folder-tree-law-delete').click({ force: true });

    // After mutation success the law disappears from the tree
    await expect(
      page.getByTestId('folder-tree-law').filter({ hasText: lawTitle }),
    ).toHaveCount(0);
  });
});
