import { expect, test } from '@playwright/test';
import {
  REAL_KAISHA_LAW_ID,
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

  test('search modal never exceeds the viewport width (no broken overflow)', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();

    await page.getByRole('button', { name: '🔍 検索' }).click();
    const modal = page.getByTestId('in-law-search-modal');
    await expect(modal).toBeVisible();

    // The dialog box must fit inside the viewport. With the old
    // `w-full mx-4` the box was 100% + 32px wide and spilled past the
    // right edge, creating a horizontal scrollbar on <html>.
    const box = await modal.locator('> div').first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width + 0.5);

    // And the document itself must not have gained horizontal scroll.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('Mobile: tab switcher reachable from the sticky toolbar', () => {
  // Several filler tabs plus a real, mockable law to switch *to*.
  const FILLER = Array.from({ length: 6 }, (_, i) => ({
    lawId: `SEED_LAW_${i}`,
    title: `長い法令名サンプル第${i}号`,
  }));
  const SEED_TABS = [
    ...FILLER,
    { lawId: REAL_KAISHA_LAW_ID, title: '会社法' },
  ];

  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    state.tabs = [...SEED_TABS];
    await installApiMocks(page, state);
  });

  test('after scrolling down, the tab button still switches laws', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();

    // Scroll the law content well past the top — this is where the old
    // top-of-page tab strip scrolled out of reach.
    const scroller = page.locator('section.flex-1.overflow-y-auto');
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // The toolbar (and its tab button) is sticky, so still on screen.
    const tabBtn = page.getByTestId('tab-switcher-button');
    await expect(tabBtn).toBeInViewport();
    await tabBtn.click();

    const menu = page.getByTestId('tab-switcher-menu');
    await expect(menu).toBeVisible();

    // Switch to 会社法 by tapping its entry — the law actually loads.
    await menu
      .locator(`[data-tab-switcher-law-id="${REAL_KAISHA_LAW_ID}"] a`)
      .click();
    await expect(page).toHaveURL(new RegExp(`/law/${REAL_KAISHA_LAW_ID}$`));
    await expect(menu).toHaveCount(0);
    await expect(page.locator('[data-anchor="条2/項1"]')).toBeAttached();
  });
});

test.describe('条文ジャンプ must not scroll the chrome off-screen', () => {
  // The actual reported trigger: tabs vanished specifically when using
  // 条文ジャンプ, not when scrolling by hand. Root cause was a window-level
  // scroll (the shell was `min-h-screen` and the viewer's hardcoded
  // `h-[calc(100vh-3rem)]` ignored the tab bar, so the body grew past the
  // viewport). `scrollIntoView` then moved the WINDOW, sliding header+tabs
  // away. Manual scroll only moved the inner region, so it never lost them.
  // Fix: a fixed-height shell (`h-screen overflow-hidden`) where only the
  // inner region scrolls.
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    state.tabs = [
      { lawId: REAL_KAISHA_LAW_ID, title: '会社法' },
      { lawId: REAL_KENPO_LAW_ID, title: '日本国憲法' },
    ];
    await installApiMocks(page, state);
  });

  test('jumping to a late article keeps header + tabs in view; window never scrolls', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();
    await expect(page.getByTestId('law-tabs')).toBeInViewport();

    // Drive the real numpad: 第99条 → Enter (confirm) → Enter (jump).
    await page.getByRole('button', { name: '= 条文ジャンプ' }).click();
    const pad = page.getByTestId('keypad');
    await pad.getByRole('button', { name: '9', exact: true }).click();
    await pad.getByRole('button', { name: '9', exact: true }).click();
    await page.getByTestId('enter-btn').click();
    await page.getByTestId('enter-btn').click();

    // Inner scroller actually moved...
    const innerTop = await page
      .locator('section.flex-1.overflow-y-auto')
      .evaluate((el) => el.scrollTop);
    expect(innerTop).toBeGreaterThan(100);

    // ...but the chrome stayed put and the window never scrolled.
    await expect(page.getByTestId('law-tabs')).toBeInViewport();
    await expect(page.locator('header')).toBeInViewport();
    const win = await page.evaluate(() => ({
      y: window.scrollY,
      overflow:
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight,
    }));
    expect(win.y).toBe(0);
    expect(win.overflow).toBeLessThanOrEqual(1);
  });
});
