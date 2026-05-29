import { expect, test } from '@playwright/test';
import {
  REAL_KAISHA_LAW_ID, createMockState, installApiMocks,
} from './fixtures.js';

test.describe('会社法第二条 — itemSentence間スペース (regression: 「一 会社株式会社…」)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('号1 (会社) の「会社」と「株式会社、合名会社…」の間に視覚的なスペースがある', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/law/${REAL_KAISHA_LAW_ID}`);
    await page.locator('[data-anchor="条2/項1/号1"]').waitFor({ state: 'visible' });

    // The 2 itemSentence spans are 「会社」 (term) and 「株式会社、合名会社、合資会社又は合同会社をいう。」 (def)
    const term = page.locator('[data-anchor="条2/項1/号1/文1"]');
    const def = page.locator('[data-anchor="条2/項1/号1/文2"]');
    await expect(term).toHaveText('会社');
    await expect(def).toContainText('株式会社、合名会社');

    // The two spans must NOT be visually adjacent — there must be a gap
    // (the inserted　全角スペース). Measure right edge of term and left
    // edge of def; gap should be >= ~3px.
    const termBox = await term.boundingBox();
    const defBox = await def.boundingBox();
    if (!termBox || !defBox) throw new Error('rect missing');
    // If they are on the same baseline, def.x should be > term.x+term.w + gap.
    const sameLine = Math.abs(termBox.y - defBox.y) < 4;
    if (sameLine) {
      const gap = defBox.x - (termBox.x + termBox.width);
      expect(gap).toBeGreaterThan(3);
    }
    // If wrapped to a new line, that's also fine — the spacer was rendered.
  });

  test('itemTitle (「一」) と itemSentence (「会社」) の間も離れている (既存の mr-1)', async ({ page }) => {
    await page.goto(`/law/${REAL_KAISHA_LAW_ID}`);
    await page.locator('[data-anchor="条2/項1/号1"]').waitFor({ state: 'visible' });
    const title = page.locator('[data-anchor="条2/項1/号1/番号"]');
    const term = page.locator('[data-anchor="条2/項1/号1/文1"]');
    await expect(title).toHaveText('一');
    const tBox = await title.boundingBox();
    const sBox = await term.boundingBox();
    if (!tBox || !sBox) throw new Error('rect missing');
    if (Math.abs(tBox.y - sBox.y) < 4) {
      const gap = sBox.x - (tBox.x + tBox.width);
      expect(gap).toBeGreaterThan(1);
    }
  });
});
