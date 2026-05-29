import { expect, test } from '@playwright/test';
import {
  REAL_KAISHA_LAW_ID, REAL_KENPO_LAW_ID,
  createMockState, installApiMocks,
} from './fixtures.js';

test.describe('In-law search (`/` key, card UI)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('`/` opens InLawSearchModal; typing yields hit cards; click jumps', async ({ page }) => {
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await page.locator('[data-anchor="条1/頭"]').waitFor({ state: 'visible' });

    await page.locator('body').press('/');
    const modal = page.getByTestId('in-law-search-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('in-law-search-input')).toBeFocused();

    // 憲法に「国民」は頻出
    await modal.getByTestId('in-law-search-input').fill('国民');
    const cards = modal.getByTestId('in-law-search-card');
    await expect(cards.first()).toBeVisible();
    const before = await cards.count();
    expect(before).toBeGreaterThan(0);

    // Click first card → modal closes, focused anchor scrolled into view
    await cards.first().click();
    await expect(modal).toHaveCount(0);
  });

  test('号 hit also shows the parent 項 柱書 (会社法 第2条1項1号「会社」)', async ({ page }) => {
    await page.goto(`/law/${REAL_KAISHA_LAW_ID}`);
    await page.locator('[data-anchor="条2/項1"]').waitFor({ state: 'attached' });

    await page.locator('body').press('/');
    const modal = page.getByTestId('in-law-search-modal');
    await expect(modal).toBeVisible();

    // 会社法 第二条 第一項 第一号 = 「会社」「株式会社、合名会社…」
    await modal.getByTestId('in-law-search-input').fill('合資会社');
    const cards = modal.getByTestId('in-law-search-card');
    await expect(cards.first()).toBeVisible();

    // The first card must include the 柱書 of the parent paragraph above
    // the matched 号 body (= 「この法律において、次の各号に…」style text).
    const pillar = cards.first().getByTestId('in-law-search-pillar');
    await expect(pillar).toBeVisible();
    await expect(pillar).toContainText('次の各号');
  });
});

test.describe('Vim-style navigation (j/k/f/b)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('`j` moves focus to a leaf 条/項/号 unit and sets data-focused on it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await page.locator('[data-anchor="条1/頭"]').waitFor({ state: 'visible' });

    // Initially nothing is focused
    await expect(page.locator('[data-focused="1"]')).toHaveCount(0);

    await page.locator('body').press('j');
    await expect(page.locator('[data-focused="1"]')).toHaveCount(1);

    // Anchor must look like 条N/項M (憲法 has multi-paragraph articles)
    const firstFocused = await page
      .locator('[data-focused="1"]')
      .getAttribute('data-anchor');
    expect(firstFocused).toMatch(/^(条\d+|前0)\/項\d+$/);

    // `k` moves focus back to the previous unit (which is the first hit
    // overall — j already moved to index 0, k clamps to 0).
    await page.locator('body').press('j');
    const second = await page
      .locator('[data-focused="1"]')
      .getAttribute('data-anchor');
    await page.locator('body').press('k');
    const back = await page
      .locator('[data-focused="1"]')
      .getAttribute('data-anchor');
    expect(back).not.toBe(second);
  });

  test('`f` scrolls forward and snaps focus to a unit near the new bottom edge', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await page.locator('[data-anchor="条1/頭"]').waitFor({ state: 'visible' });

    // Capture the scroll-container's scrollTop before/after `f`
    const scrollerSelector = 'section.flex-1.overflow-y-auto';
    const before = await page.locator(scrollerSelector).evaluate((el) => el.scrollTop);
    await page.locator('body').press('f');
    await page.waitForTimeout(60); // rAF + state set
    const after = await page.locator(scrollerSelector).evaluate((el) => el.scrollTop);
    expect(after).toBeGreaterThan(before);

    // A focused unit must be set and its rect must lie within the current viewport
    const focused = page.locator('[data-focused="1"]');
    await expect(focused).toHaveCount(1);
    const box = await focused.boundingBox();
    if (!box) throw new Error('focused unit has no bounding box');
    expect(box.y).toBeLessThan(800);
    expect(box.y + box.height).toBeGreaterThan(0);
  });
});

test.describe('Shortcut help moved to `g /` chord', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('plain `/` no longer opens help; `g /` chord does', async ({ page }) => {
    await page.goto('/');
    // Plain `/` should not open the shortcut help modal anymore
    await page.locator('body').press('/');
    await expect(page.getByTestId('shortcut-help-modal')).toHaveCount(0);

    // `g` then `/` opens help
    await page.locator('body').press('g');
    await page.locator('body').press('/');
    await expect(page.getByTestId('shortcut-help-modal')).toBeVisible();
  });

  test('`g/` chord stops propagation so in-law search does NOT also open', async ({ page }) => {
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await page.locator('[data-anchor="条1/頭"]').waitFor({ state: 'visible' });
    await page.locator('body').press('g');
    await page.locator('body').press('/');
    await expect(page.getByTestId('shortcut-help-modal')).toBeVisible();
    await expect(page.getByTestId('in-law-search-modal')).toHaveCount(0);
  });
});
