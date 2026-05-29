import { expect, test } from '@playwright/test';
import {
  LAW_ID, REAL_KENPO_LAW_ID,
  createMockState, installApiMocks,
} from './fixtures.js';

/**
 * Cross-device open-tab sync via SQLite.
 *
 * Server is source of truth; localStorage is an offline cache. On cold
 * start we:
 *  1. GET /api/tabs and replace local state with the server's tabs.
 *  2. After hydrate, any open/close/move fires a debounced PUT.
 *
 * The fixture mock for /api/tabs is stateful (PUTs update an in-memory
 * list, GETs return it), so we can simulate "another device already
 * opened these tabs" by seeding state.tabs.
 */

test.describe('Tabs cold-start hydrate', () => {
  test('GET /api/tabs populates tabs on initial load (other device already had them)', async ({ page }) => {
    const state = createMockState();
    // Pretend another device opened these two tabs earlier and pushed
    // them to the server. The browser starts with empty localStorage.
    state.tabs = [
      { lawId: 'OTHER_DEVICE_A', title: '別端末のタブA' },
      { lawId: 'OTHER_DEVICE_B', title: '別端末のタブB' },
    ];
    await installApiMocks(page, state);

    await page.goto('/');
    // Both tab labels should be present in the tab bar even though we
    // never visited their URLs in this session.
    await expect(
      page.locator('[data-tab-law-id="OTHER_DEVICE_A"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-tab-law-id="OTHER_DEVICE_B"]'),
    ).toBeVisible();
  });

  test('GET returning empty + visiting /law/X pushes that tab back up to the server', async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);

    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();
    await page.waitForResponse(
      (r) => r.url().includes('/api/tabs') && r.request().method() === 'PUT',
    );
    expect(state.tabs).toEqual([{ lawId: LAW_ID, title: 'テスト法' }]);
  });
});

test.describe('Tabs mutations PUT the new list', () => {
  test('opening a 2nd tab triggers a PUT containing both tabs in order', async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);

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

    expect(state.tabs.map((t) => t.lawId)).toEqual([LAW_ID, REAL_KENPO_LAW_ID]);
  });

  test('closing a tab via × triggers a PUT with the remaining list', async ({ page }) => {
    const state = createMockState();
    state.tabs = [
      { lawId: LAW_ID, title: 'テスト法' },
      { lawId: REAL_KENPO_LAW_ID, title: '日本国憲法' },
    ];
    await installApiMocks(page, state);

    // Land on /law/REAL_KENPO so it's the active tab and × is visible
    // without needing hover.
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();

    const activeClose = page
      .locator('[data-tab-law-id][data-active="1"]')
      .locator('[data-tab-close]');
    await activeClose.click();

    await page.waitForResponse(
      (r) => r.url().includes('/api/tabs') && r.request().method() === 'PUT',
    );
    expect(state.tabs.map((t) => t.lawId)).toEqual([LAW_ID]);
  });
});

test.describe('Tabs sync resilience', () => {
  test('GET /api/tabs returning 500 falls back to localStorage cache (no crash)', async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
    // Override the default /api/tabs route to fail on GET.
    await page.route('**/api/tabs', (r) => {
      if (r.request().method() === 'PUT') {
        return r.fulfill({ status: 200, body: JSON.stringify({ ok: true, count: 0 }) });
      }
      return r.fulfill({ status: 500, body: '{}' });
    });

    await page.goto(`/law/${LAW_ID}`);
    // Body still renders; the failed hydrate just leaves whatever was in
    // localStorage (here: nothing).
    await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();
    // And the just-opened tab is locally usable.
    await expect(
      page.locator(`[data-tab-law-id="${LAW_ID}"]`),
    ).toBeVisible();
  });
});
