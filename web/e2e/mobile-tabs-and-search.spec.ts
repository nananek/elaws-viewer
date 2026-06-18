import { expect, test } from '@playwright/test';
import {
  REAL_KENPO_LAW_ID,
  createMockState,
  installApiMocks,
} from './fixtures.js';

/**
 * Two reported mobile/PWA bugs:
 *
 *   1. Switching laws is impossible because tabs get hidden with no way
 *      to reveal them. The tab bar used `flex-wrap`, so on a narrow
 *      screen many tabs piled into extra rows that grew downward; with
 *      no scroll/overflow affordance those rows pushed the viewer down
 *      and off-screen. Fix: single-row, horizontally-scrollable strip
 *      (`flex-nowrap overflow-x-auto`, tabs `shrink-0`).
 *
 *   2. In-law text search was `/`-only — there was no clickable button,
 *      so on a phone (no physical keyboard) the feature was unreachable.
 *      Fix: a "🔍 検索" button in the viewer header next to "条文ジャンプ".
 */

// A phone-sized viewport — the environment where both bugs were reported.
const PHONE = { width: 390, height: 740 };

test.describe('Mobile: law tabs stay reachable (no flex-wrap pile-up)', () => {
  // Many open tabs with long titles, seeded so the bar must overflow a
  // narrow viewport. Distinct lawIds so each is its own tab.
  const MANY_TABS = Array.from({ length: 12 }, (_, i) => ({
    lawId: `SEED_LAW_${i}`,
    title: `とても長い法令名のサンプル第${i}号（民法・会社法・刑事訴訟法）`,
  }));

  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    // Seed the server's open-tab list so the store hydrates all of them.
    state.tabs = [...MANY_TABS];
    await installApiMocks(page, state);
  });

  test('tab bar overflows horizontally on one row instead of stacking rows', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();

    const bar = page.getByTestId('law-tabs');
    await expect(bar).toBeVisible();
    // All seeded tabs plus the one we navigated to must render.
    const tabs = page.locator('[data-tab-law-id]');
    await expect(tabs).toHaveCount(MANY_TABS.length + 1);

    const metrics = await bar.evaluate((el) => ({
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      overflowX: getComputedStyle(el).overflowX,
    }));

    // Content must overflow the viewport horizontally (the whole point of
    // a scroll strip). With the old `flex-wrap`, scrollWidth would equal
    // clientWidth and this would fail — the regression guard.
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    // It must be horizontally scrollable.
    expect(metrics.overflowX).toMatch(/auto|scroll/);

    // The bar must stay a SINGLE row. One row of tabs is well under 60px;
    // a flex-wrap pile-up of 13 long-titled tabs on a 390px phone would
    // be many rows tall. Measure against a single tab's height.
    const tabHeight = (await tabs.first().boundingBox())!.height;
    expect(metrics.clientHeight).toBeLessThan(tabHeight * 2);
  });

  test('a tab scrolled off the right edge can be brought into view', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();

    const bar = page.getByTestId('law-tabs');
    const lastTab = page.locator(`[data-tab-law-id="SEED_LAW_${MANY_TABS.length - 1}"]`);
    await expect(lastTab).toHaveCount(1);

    // Off-screen initially: its left edge is past the bar's right edge.
    const offscreen = await lastTab.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const parent = el.parentElement!.getBoundingClientRect();
      return r.left >= parent.right;
    });
    expect(offscreen).toBe(true);

    // Scrolling the strip horizontally reveals it (touch swipe / scroll).
    await bar.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(lastTab).toBeInViewport();
  });
});

test.describe('Mobile: in-law search reachable via button (no keyboard)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('header "検索" button opens the in-law search modal and it works', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();

    // No keyboard press — tap the button, the way a phone user would.
    const searchBtn = page.getByRole('button', { name: '🔍 検索' });
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();

    const modal = page.getByTestId('in-law-search-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('in-law-search-input')).toBeFocused();

    // It actually searches: 憲法に「国民」は頻出。
    await modal.getByTestId('in-law-search-input').fill('国民');
    const cards = modal.getByTestId('in-law-search-card');
    await expect(cards.first()).toBeVisible();

    // Clicking a hit jumps and closes the modal.
    await cards.first().click();
    await expect(modal).toHaveCount(0);
  });
});
