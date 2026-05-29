import { expect, test } from '@playwright/test';
import {
  LAW_ID,
  REAL_KAISHA_LAW_ID,
  REAL_KENPO_LAW_ID,
  createMockState,
  installApiMocks,
} from './fixtures.js';

test.describe('Phase 10 PR B — paper-like style overhaul (#3)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('paper background + 明朝 body font are applied', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toBeVisible();

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // #faf6ee → rgb(250, 246, 238)
    expect(bg).toBe('rgb(250, 246, 238)');

    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toMatch(/Mincho|Serif|serif/i);
  });

  test('dark-mode wiring is gone (no ThemeToggle, no .dark on <html>)', async ({ page }) => {
    await page.goto(`/`);
    await expect(page.getByRole('button', { name: /ダーク|ライト|システム/ })).toHaveCount(0);
    await expect(page.locator('button[title^="テーマ:"]')).toHaveCount(0);
    const htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).not.toMatch(/\bdark\b/);
    const colorScheme = await page.evaluate(() => document.documentElement.style.colorScheme);
    expect(colorScheme).not.toBe('dark');
  });

  test('会社法 第二条 renders as horizontal hanging-indent list (no vertical-rl)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/law/${REAL_KAISHA_LAW_ID}`);
    await expect(page.locator('[data-anchor="題名"]')).toHaveText('会社法');

    const paragraph = page.locator('[data-anchor="条2/項1"]');
    await expect(paragraph).toBeVisible();

    // The Phase 10 PR B vertical-rl experiment is reverted — paragraphs no
    // longer carry data-vertical and writing-mode must be horizontal-tb.
    await expect(paragraph).not.toHaveAttribute('data-vertical', /.*/);
    const writingMode = await paragraph.evaluate((el) => getComputedStyle(el).writingMode);
    expect(writingMode).toBe('horizontal-tb');

    // Items render top-to-bottom (each on its own line), not as side-by-side
    // columns. 号1 must sit above 号2.
    const box1 = await page.locator('[data-anchor="条2/項1/号1"]').boundingBox();
    const box2 = await page.locator('[data-anchor="条2/項1/号2"]').boundingBox();
    if (!box1 || !box2) throw new Error('号1/号2 not measurable');
    expect(box2.y).toBeGreaterThan(box1.y + 4);

    // Paragraph itself must fit within the viewport — no horizontal scroll.
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const paraBox = await paragraph.boundingBox();
    if (!paraBox) throw new Error('paragraph not measurable');
    expect(paraBox.x + paraBox.width).toBeLessThanOrEqual(viewportWidth);
  });

  test('会社法 第二条三号の二 イ/ロ Subitems stack vertically (not flex-row siblings)', async ({ page }) => {
    await page.goto(`/law/${REAL_KAISHA_LAW_ID}`);
    await expect(page.locator('[data-anchor="題名"]')).toHaveText('会社法');

    // The parser numbers items by sequence: 一/二/三/三の二 → 号1/号2/号3/号4.
    // 号4 has Subitem 1 (イ) and Subitem 2 (ロ); they must each render as a
    // block (own line) instead of becoming flex row siblings.
    const parentItem = page.locator('[data-anchor="条2/項1/号4"]');
    await expect(parentItem).toBeVisible();
    await expect(parentItem).toHaveAttribute('data-depth', '0');

    const sub1 = parentItem.locator('[data-anchor="条2/項1/号4/小1"]');
    const sub2 = parentItem.locator('[data-anchor="条2/項1/号4/小2"]');
    await expect(sub1).toBeVisible();
    await expect(sub2).toBeVisible();
    await expect(sub1).toHaveAttribute('data-depth', '1');
    await expect(sub2).toHaveAttribute('data-depth', '1');

    // The two Subitems must stack vertically (different y), not be flex
    // siblings on the same baseline as in the original 会社法 2 条 bug.
    const box1 = await sub1.boundingBox();
    const box2 = await sub2.boundingBox();
    if (!box1 || !box2) throw new Error('Subitems not measurable');
    expect(box2.y).toBeGreaterThan(box1.y + 4);
  });

  test('AnchorJumpModal jump to a paragraph lands BELOW the sticky header (scroll-padding-top)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await page.locator('[data-anchor="条1/頭"]').waitFor({ state: 'visible' });

    // Jump to 第14条第1項 — paragraph-level target. Pre-fix it landed
    // ~47px above the sticky header bottom (hidden). After adding
    // scroll-pt-28 on the scroll container, target.top must be >= sticky
    // bottom (with a few px tolerance for sub-pixel rounding).
    await page.locator('body').press('=');
    await page.getByTestId('anchor-jump-modal').waitFor({ state: 'visible' });
    for (const k of ['1', '4', '.', '1']) {
      await page.locator('body').press(k);
    }
    await page.locator('body').press('Enter');
    await page.locator('body').press('Enter');
    await page.getByTestId('anchor-jump-modal').waitFor({ state: 'detached' });

    const { stickyBottom, targetTop } = await page.evaluate(() => {
      const sticky = document.querySelector<HTMLElement>('.sticky.top-0');
      const target = document.querySelector<HTMLElement>('[data-anchor="条14/項1"]');
      return {
        stickyBottom: sticky ? sticky.getBoundingClientRect().bottom : null,
        targetTop: target ? target.getBoundingClientRect().top : null,
      };
    });

    expect(stickyBottom).not.toBeNull();
    expect(targetTop).not.toBeNull();
    // Pre-fix: targetTop was 47px (hidden). Post-fix: targetTop should be
    // at or below stickyBottom (~95px).
    expect(targetTop!).toBeGreaterThanOrEqual(stickyBottom! - 4);
  });

  test('PWA manifest uses cream theme/background color', async ({ page }) => {
    await page.goto(`/`);
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor?.toLowerCase()).toBe('#faf6ee');
  });
});
