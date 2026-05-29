import { expect, test } from '@playwright/test';
import {
  LAW_ID,
  REAL_KAISHA_LAW_ID,
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

  test('会社法 第二条 (definitions) renders with data-vertical="1" and writing-mode: vertical-rl', async ({ page }) => {
    await page.goto(`/law/${REAL_KAISHA_LAW_ID}`);
    await expect(page.locator('[data-anchor="題名"]')).toHaveText('会社法');

    const paragraph = page.locator('[data-anchor="条2/項1"]');
    await expect(paragraph).toBeVisible();
    await expect(paragraph).toHaveAttribute('data-vertical', '1');

    const writingMode = await paragraph.evaluate((el) => getComputedStyle(el).writingMode);
    expect(writingMode).toBe('vertical-rl');
  });

  test('会社法 第二条 vertical paragraph stays bounded inside parent column (does not blow out)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/law/${REAL_KAISHA_LAW_ID}`);
    await expect(page.locator('[data-anchor="題名"]')).toHaveText('会社法');

    // The paragraph contains ~38 vertical-rl columns of content (~4000px
    // intrinsic). Without `max-width: 100%` the element blows out to its
    // content width and the page itself scrolls horizontally — the regression
    // that motivated this guard. After the fix, the paragraph must be
    // narrower than the viewport and have actual horizontal scroll inside.
    const { clientWidth, scrollWidth, paragraphX, paragraphRight, viewportWidth } =
      await page.locator('[data-anchor="条2/項1"]').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          paragraphX: r.x,
          paragraphRight: r.x + r.width,
          viewportWidth: window.innerWidth,
        };
      });
    expect(clientWidth).toBeLessThan(viewportWidth); // bounded
    expect(scrollWidth).toBeGreaterThan(clientWidth); // actually scrolls
    expect(paragraphX).toBeGreaterThanOrEqual(0);
    expect(paragraphRight).toBeLessThanOrEqual(viewportWidth);

    // In vertical-rl, scrollLeft=0 means the first content (rightmost) is
    // visible. So 号1 must be inside the viewport (not scrolled offscreen).
    const item1Box = await page.locator('[data-anchor="条2/項1/号1"]').boundingBox();
    if (!item1Box) throw new Error('号1 not measurable');
    // Allow a small margin for the element being slightly clipped at the
    // very edge of the scroll viewport (browsers report bounding boxes that
    // include the part hidden by overflow).
    expect(item1Box.x).toBeLessThan(paragraphRight + 8);
    expect(item1Box.x + item1Box.width).toBeGreaterThan(paragraphX - 8);
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

    // The two Subitems must NOT be side-by-side. Compare their bounding
    // boxes — within vertical writing mode the columns advance right-to-
    // left, but each Subitem still occupies its own column / row, so
    // their bounding rects must not be horizontal flex siblings on the
    // same baseline.
    const box1 = await sub1.boundingBox();
    const box2 = await sub2.boundingBox();
    if (!box1 || !box2) throw new Error('Subitems not measurable');
    // Allow either: stacked (different y) or columnar (different x). The
    // failure mode we are guarding against is identical top AND
    // overlapping x ranges from the old `flex gap-2 pl-8` layout.
    const sameTop = Math.abs(box1.y - box2.y) < 4;
    const xOverlap = !(box1.x + box1.width <= box2.x || box2.x + box2.width <= box1.x);
    expect(sameTop && xOverlap).toBe(false);
  });

  test('PWA manifest uses cream theme/background color', async ({ page }) => {
    await page.goto(`/`);
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor?.toLowerCase()).toBe('#faf6ee');
  });
});
