import { expect, test } from '@playwright/test';
import {
  LAW_ID, REAL_KENPO_LAW_ID,
  createMockState, installApiMocks,
} from './fixtures.js';

const MIN_TAP = 44;

/**
 * Tab close-button visibility model
 * ---------------------------------
 * On iPad / coarse-pointer devices the bar of every tab gets accidentally
 * tapped when the user is trying to *switch* tabs. To prevent that:
 *
 *   * Active tab `×`: always visible.
 *   * Non-active tab `×`: hidden by default; revealed on hover ONLY on
 *     hover-capable mouse devices (`pointer: fine`). On touch we never
 *     reveal it — switch first, then close.
 *
 * The CSS expression is `pointer-fine:group-hover:inline-flex`, so a real
 * media-query driven test is the only thing that catches a regression
 * (a class-name assertion would lie).
 */

async function openTwoTabs(page: import('@playwright/test').Page): Promise<void> {
  // After each hard navigation, wait for the debounced PUT /api/tabs to
  // flush so the next page-load's GET sees the updated server state.
  // Without this, the second page never finds the first tab and only one
  // tab renders.
  await page.goto(`/law/${LAW_ID}`);
  await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();
  await page.waitForResponse(
    (r) => r.url().includes('/api/tabs') && r.request().method() === 'PUT',
  );
  await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
  await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();
  await page.waitForResponse(
    (r) => r.url().includes('/api/tabs') && r.request().method() === 'PUT',
  );
}

test.describe('LawTabs × button visibility (desktop, pointer:fine)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('active tab × is always visible; non-active × appears only on hover', async ({ page }) => {
    // Confirm the test environment is reporting `pointer:fine` as expected.
    await page.goto('/');
    const fine = await page.evaluate(
      () => window.matchMedia('(pointer: fine)').matches,
    );
    expect(fine).toBe(true);

    await openTwoTabs(page);

    const activeTab = page.locator('[data-tab-law-id][data-active="1"]');
    const inactiveTab = page.locator('[data-tab-law-id][data-active="0"]').first();
    await expect(activeTab).toHaveCount(1);
    await expect(inactiveTab).toHaveCount(1);

    // 1. Active tab × is visible without any hover.
    const activeClose = activeTab.locator('[data-tab-close]');
    await expect(activeClose).toBeVisible();

    // 2. Non-active tab × is hidden until hover.
    const inactiveClose = inactiveTab.locator('[data-tab-close]');
    await expect(inactiveClose).toBeHidden();

    // 3. Hovering the non-active tab reveals its ×.
    await inactiveTab.hover();
    await expect(inactiveClose).toBeVisible();
  });

  // Regression for "tab width jitters when × pops in on hover": the
  // close button is `invisible` (not `hidden`) on non-active tabs so
  // its layout slot is reserved; flipping `visibility` between hover
  // states must NOT change the tab's bounding box.
  test('non-active tab width is identical whether × is hovered or not', async ({ page }) => {
    await page.goto('/');
    await openTwoTabs(page);

    const inactiveTab = page
      .locator('[data-tab-law-id][data-active="0"]')
      .first();
    await expect(inactiveTab).toHaveCount(1);

    // Park the mouse far from the tab bar so the hover state is OFF.
    await page.mouse.move(0, 600);
    const noHover = await inactiveTab.boundingBox();
    expect(noHover).not.toBeNull();

    await inactiveTab.hover();
    const onHover = await inactiveTab.boundingBox();
    expect(onHover).not.toBeNull();

    // 1-px tolerance for sub-pixel rounding.
    expect(Math.abs(noHover!.width - onHover!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(noHover!.height - onHover!.height)).toBeLessThanOrEqual(1);
  });
});

test.describe('LawTabs × button visibility (touch, pointer:coarse)', () => {
  test.use({ hasTouch: true });

  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('active tab × visible & ≥44px; non-active × stays hidden even after "hover"', async ({ page }) => {
    await page.goto('/');
    const coarse = await page.evaluate(
      () => window.matchMedia('(pointer: coarse)').matches,
    );
    expect(coarse).toBe(true);
    const finePointer = await page.evaluate(
      () => window.matchMedia('(pointer: fine)').matches,
    );
    expect(finePointer).toBe(false);

    await openTwoTabs(page);

    const activeTab = page.locator('[data-tab-law-id][data-active="1"]');
    const inactiveTab = page.locator('[data-tab-law-id][data-active="0"]').first();

    // Active × must be visible AND at least 44 × 44 px.
    const activeClose = activeTab.locator('[data-tab-close]');
    await expect(activeClose).toBeVisible();
    const aBox = await activeClose.boundingBox();
    expect(aBox).not.toBeNull();
    expect(aBox!.width).toBeGreaterThanOrEqual(MIN_TAP);
    expect(aBox!.height).toBeGreaterThanOrEqual(MIN_TAP);

    // Non-active × must stay hidden — hovering must not reveal it
    // (pointer:coarse devices never trigger the reveal rule).
    const inactiveClose = inactiveTab.locator('[data-tab-close]');
    await expect(inactiveClose).toBeHidden();
    await inactiveTab.hover();
    await expect(inactiveClose).toBeHidden();
  });
});

test.describe('Global button sizes ≥ 44 px', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('ShortcutHelp ? button is at least 44×44 px', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByTestId('shortcut-help-button');
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(MIN_TAP);
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP);
  });

  test('ShortcutHelp modal close × button is at least 44×44 px', async ({ page }) => {
    await page.goto('/');
    // Open via the always-on `?` button (g/ chord verified elsewhere).
    await page.getByTestId('shortcut-help-button').click();
    const modal = page.getByTestId('shortcut-help-modal');
    await expect(modal).toBeVisible();
    const closeBtn = modal.locator('button[aria-label="閉じる"]');
    const box = await closeBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(MIN_TAP);
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP);
  });

  test('InLawSearchModal close × is at least 44×44 px', async ({ page }) => {
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();
    await page.locator('body').press('/');
    const modal = page.getByTestId('in-law-search-modal');
    await expect(modal).toBeVisible();
    const close = page.getByTestId('in-law-search-close');
    const box = await close.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(MIN_TAP);
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP);
  });
});
