import { expect, test } from '@playwright/test';
import { LAW_ID, createMockState, installApiMocks } from './fixtures.js';

/**
 * The bundled APP_VERSION at preview time falls back to "dev" or whatever
 * `git rev-parse --short HEAD` produced when the test build ran. The store
 * suppresses the banner whenever either side is "dev", so the bumped
 * version we send in tests must be a non-"dev" literal AND different from
 * whatever the build embedded.
 */
const BUMPED_SERVER_VERSION = 'test-newer-version';

test.describe('Version handshake', () => {
  test('banner is hidden when server omits the X-App-Version header', async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');
    await expect(page.locator('[data-update-banner]')).toHaveCount(0);
  });

  test('banner appears when server reports a different X-App-Version', async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state, { serverVersion: BUMPED_SERVER_VERSION });
    await page.goto(`/law/${LAW_ID}`);

    // Need at least one /api call to feed observeServerVersion. The viewer
    // already does this when loading body + selections.
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');

    // If the bundle was built with APP_VERSION === BUMPED_SERVER_VERSION the
    // banner correctly stays hidden — in which case this test would need a
    // different sentinel, so make that failure mode obvious.
    const banner = page.locator('[data-update-banner]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('新しいバージョンが利用可能です');
    await expect(banner).toContainText(BUMPED_SERVER_VERSION);
    await expect(banner.getByRole('button', { name: 'リロード' })).toBeVisible();
  });

  test('banner stays hidden when server version matches the bundled "dev" fallback', async ({ page }) => {
    // The store explicitly suppresses banners when EITHER side is "dev" so
    // dev workflows (hot-reload server vs built web) don't spam updates.
    const state = createMockState();
    await installApiMocks(page, state, { serverVersion: 'dev' });
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');
    await expect(page.locator('[data-update-banner]')).toHaveCount(0);
  });
});
