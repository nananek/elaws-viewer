import { expect, test } from '@playwright/test';
import {
  LAW_ID, KENPO_LAW_ID, REAL_MINPO_LAW_ID,
  createMockState, installApiMocks,
} from './fixtures.js';

test.describe('Phase 10 PR C — navigation cleanup (#8 #9)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('header has only 法令一覧 and 設定 (検索/ブックマーク/タグ removed)', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header').first();
    await expect(header.getByRole('link', { name: '法令一覧' })).toBeVisible();
    await expect(header.getByRole('link', { name: '設定' })).toBeVisible();
    await expect(header.getByRole('link', { name: '検索' })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'ブックマーク' })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'タグ' })).toHaveCount(0);
  });

  test('LawViewer no longer renders ★ ブックマーク FAB', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');
    await expect(page.getByRole('button', { name: /ブックマーク/ })).toHaveCount(0);
  });
});

test.describe('Phase 10 PR C — = AnchorJumpModal + / GlobalLawSearchModal (#4)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('= key opens AnchorJumpModal with numeric pad', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');

    await page.locator('body').press('=');
    const modal = page.getByTestId('anchor-jump-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('keypad')).toBeVisible();
    // Empty state: natural label shows the placeholder for 条.
    await expect(modal.getByTestId('natural-label')).toContainText('第');
    await expect(modal.getByTestId('natural-label')).toContainText('条');
    // Enter button starts as 「条」 (confirms article number).
    await expect(modal.getByTestId('enter-btn')).toHaveText('条');
  });

  test('typing 2 then Enter Enter scrolls to 第二条 (two-step Enter)', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');

    await page.locator('body').press('=');
    const modal = page.getByTestId('anchor-jump-modal');
    await expect(modal).toBeVisible();

    await page.locator('body').press('2');
    await expect(modal.getByTestId('natural-label')).toContainText('第2');

    // 1st Enter: confirm — modal stays open, Enter label flips to 「移動」.
    await page.locator('body').press('Enter');
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('enter-btn')).toHaveText('移動');

    // 2nd Enter: jump.
    await page.locator('body').press('Enter');
    await expect(page.getByTestId('anchor-jump-modal')).toHaveCount(0);
    await expect(page.locator('[data-anchor="条2"]')).toBeInViewport();
  });

  test('/ and ? are fully suppressed inside AnchorJumpModal (no other modal opens)', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await page.locator('body').press('=');
    const modal = page.getByTestId('anchor-jump-modal');
    await expect(modal).toBeVisible();

    await page.locator('body').press('8');
    await page.locator('body').press('9');
    await page.locator('body').press('9');
    await page.locator('body').press('/');
    await page.locator('body').press('?');

    // Neither in-law search nor GlobalLawSearchModal must open. AnchorJumpModal
    // must remain open with 第899条 still in its label (both keys are no-ops here).
    await expect(page.getByTestId('global-search-modal')).toHaveCount(0);
    await expect(page.getByTestId('in-law-search-modal')).toHaveCount(0);
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('natural-label')).toContainText('第899');
  });

  test('? key (no focused input, no modal) opens GlobalLawSearchModal', async ({ page }) => {
    await page.goto('/');
    await page.locator('body').press('?');
    const modal = page.getByTestId('global-search-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('global-search-input')).toBeFocused();
  });

  test('Esc closes the AnchorJumpModal', async ({ page }) => {
    await page.goto(`/law/${KENPO_LAW_ID}`);
    await page.locator('body').press('=');
    await expect(page.getByTestId('anchor-jump-modal')).toBeVisible();
    await page.locator('body').press('Escape');
    await expect(page.getByTestId('anchor-jump-modal')).toHaveCount(0);
  });
});

test.describe('Phase 10 PR C — テンキー `.` separator + smart-skip (民法 real fixture)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('899.2.1 Enter Enter → 第899条の2 第1項 自然表記とジャンプ', async ({ page }) => {
    await page.goto(`/law/${REAL_MINPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="条899/頭"]').first()).toBeVisible();

    await page.locator('body').press('=');
    const modal = page.getByTestId('anchor-jump-modal');
    await expect(modal).toBeVisible();

    for (const k of ['8', '9', '9', '.', '2', '.', '1']) {
      await page.locator('body').press(k);
    }
    // Natural display should read 第899条の2 第1項
    await expect(modal.getByTestId('natural-label')).toContainText('第899条の2');
    await expect(modal.getByTestId('natural-label')).toContainText('第1項');
    // Enter label is the current field 「項」 (typing paragraph).
    await expect(modal.getByTestId('enter-btn')).toHaveText('項');

    // Confirm → jump.
    await page.locator('body').press('Enter');
    await expect(modal.getByTestId('enter-btn')).toHaveText('移動');
    await page.locator('body').press('Enter');

    await expect(page.getByTestId('anchor-jump-modal')).toHaveCount(0);
    await expect(page.locator('[data-anchor="条899_2/項1"]').first()).toBeInViewport();
  });

  test('400 + . is a no-op (民法400条 has no sub-articles and only 1 paragraph)', async ({ page }) => {
    await page.goto(`/law/${REAL_MINPO_LAW_ID}`);
    await page.locator('body').press('=');
    const modal = page.getByTestId('anchor-jump-modal');
    await expect(modal).toBeVisible();

    for (const k of ['4', '0', '0']) {
      await page.locator('body').press(k);
    }
    // Both `.` and `+` buttons are disabled because no applicable next field.
    await expect(modal.getByTestId('dot-btn')).toBeDisabled();
    await expect(modal.getByTestId('plus-btn')).toBeDisabled();

    // Pressing `.` or `+` on the keyboard is also a no-op.
    await page.locator('body').press('.');
    await page.locator('body').press('+');
    await expect(modal.getByTestId('natural-label')).not.toContainText('の');
    await expect(modal.getByTestId('natural-label')).not.toContainText('第1項');

    // Enter Enter still jumps to 第400条.
    await page.locator('body').press('Enter');
    await page.locator('body').press('Enter');
    await expect(page.locator('[data-anchor="条400"]').first()).toBeInViewport();
  });

  test('899 + . advances to の (民法899条 has sub-article 第899条の2)', async ({ page }) => {
    await page.goto(`/law/${REAL_MINPO_LAW_ID}`);
    await page.locator('body').press('=');
    const modal = page.getByTestId('anchor-jump-modal');
    await expect(modal).toBeVisible();

    for (const k of ['8', '9', '9']) {
      await page.locator('body').press(k);
    }
    // Both `.` and `+` buttons are enabled (same action); the upcoming-field
    // hint 「の」 is shown on the wider `+` button.
    await expect(modal.getByTestId('dot-btn')).toBeEnabled();
    await expect(modal.getByTestId('plus-btn')).toBeEnabled();
    await expect(modal.getByTestId('plus-btn')).toContainText('の');

    await page.locator('body').press('.');
    // Now in の field — Enter label = 「の」, natural label shows trailing の_.
    await expect(modal.getByTestId('enter-btn')).toHaveText('の');
    await expect(modal.getByTestId('natural-label')).toContainText('第899条');
    await expect(modal.getByTestId('natural-label')).toContainText('の');
  });

  test('`+` key advances field the same as `.` (physical numpad alias)', async ({ page }) => {
    await page.goto(`/law/${REAL_MINPO_LAW_ID}`);
    await page.locator('body').press('=');
    const modal = page.getByTestId('anchor-jump-modal');

    // 899+2+1 should produce the same state as 899.2.1
    for (const k of ['8', '9', '9', '+', '2', '+', '1']) {
      await page.locator('body').press(k);
    }
    await expect(modal.getByTestId('natural-label')).toContainText('第899条の2');
    await expect(modal.getByTestId('natural-label')).toContainText('第1項');
  });

  test('Backspace from の field rewinds to article field', async ({ page }) => {
    await page.goto(`/law/${REAL_MINPO_LAW_ID}`);
    await page.locator('body').press('=');
    const modal = page.getByTestId('anchor-jump-modal');

    for (const k of ['8', '9', '9', '.']) {
      await page.locator('body').press(k);
    }
    await expect(modal.getByTestId('enter-btn')).toHaveText('の');

    // Backspace with empty の rewinds to article field.
    await page.locator('body').press('Backspace');
    await expect(modal.getByTestId('enter-btn')).toHaveText('条');
    // Article value preserved.
    await expect(modal.getByTestId('natural-label')).toContainText('第899');
    // Next backspace deletes the last digit.
    await page.locator('body').press('Backspace');
    await expect(modal.getByTestId('natural-label')).toContainText('第89');
    await expect(modal.getByTestId('natural-label')).not.toContainText('第899');
  });
});

test.describe('Phase 10 PR C — Settings UI rewrite (#10)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('Settings page exposes ファイルを選ぶ button and インポート実行 (disabled until selection)', async ({ page }) => {
    await page.goto('/settings');
    const choose = page.getByRole('button', { name: 'ファイルを選ぶ' });
    const exec = page.getByRole('button', { name: 'インポート実行' });
    await expect(choose).toBeVisible();
    await expect(exec).toBeVisible();
    await expect(exec).toBeDisabled();
  });

  test('Settings page selecting a file enables インポート実行 and shows the name', async ({ page }) => {
    await page.goto('/settings');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'sample.realm',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('Tdata-bytes'.repeat(64), 'utf8'),
    });
    await expect(page.getByTestId('selected-file')).toContainText('sample.realm');
    await expect(page.getByRole('button', { name: 'インポート実行' })).toBeEnabled();
  });

  test('Settings page renders MergeStats result after a successful import', async ({ page }) => {
    await page.route('**/api/import/realm', (r) =>
      r.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ok: true,
          stats: {
            selections: { created: 12, updated: 3, skipped: 47 },
            bookmarks: { created: 0, updated: 1, skipped: 2 },
            tags: { created: 1, updated: 0, skipped: 0 },
            tagEntities: { updated: 0 },
            downloads: { created: 2, updated: 1, skipped: 0 },
            organizables: { created: 0, updated: 0, skipped: 0 },
            errors: [],
          },
        }),
      }),
    );

    await page.goto('/settings');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'data.realm',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('x'.repeat(256), 'utf8'),
    });
    await page.getByRole('button', { name: 'インポート実行' }).click();

    const result = page.getByTestId('merge-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText('新規 12 / 更新 3 / スキップ 47');
    await expect(result).toContainText('SelectionObject');
    await expect(result).toContainText('Bookmark');
  });
});

test.describe('Phase 10 PR C — Home + AddLawModal + FolderTree (#6)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('Home page renders + 法令を追加 button and the (empty) folder tree', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('add-law-button')).toBeVisible();
    await expect(page.getByTestId('folder-tree')).toBeVisible();
  });

  test('Clicking + 法令を追加 opens AddLawModal', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('add-law-button').click();
    await expect(page.getByTestId('add-law-modal')).toBeVisible();
    await expect(page.getByTestId('add-law-search-input')).toBeFocused();
  });
});
