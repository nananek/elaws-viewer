import { expect, test } from '@playwright/test';
import {
  LAW_ID, SENTENCE_1, SENTENCE_2,
  KENPO_LAW_ID, KENPO_LAW_TITLE, KENPO_PREAMBLE_SENTENCE, KENPO_ARTICLE_1, KENPO_ARTICLE_103,
  REAL_KENPO_LAW_ID,
  createMockState, installApiMocks,
} from './fixtures.js';

/**
 * Select a substring at [start, start+length) within the element matching
 * `selector`, walking all descendant text nodes to map the global char
 * offset back to (node, offset). Robust to overlay wrapping that splits
 * the original text node into multiple chunks.
 */
async function selectTextRange(
  page: import('@playwright/test').Page,
  selector: string,
  start: number,
  length: number,
): Promise<void> {
  await page.evaluate(
    ({ selector, start, length }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`no element for ${selector}`);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      const offsets: number[] = [];
      let acc = 0;
      while (walker.nextNode()) {
        const n = walker.currentNode as Text;
        nodes.push(n);
        offsets.push(acc);
        acc += n.data.length;
      }
      const end = start + length;
      if (end > acc) throw new Error(`range [${start},${end}) exceeds text length ${acc}`);
      function locate(global: number): { node: Text; offset: number } {
        for (let i = 0; i < nodes.length; i++) {
          const o = offsets[i]!;
          const len = nodes[i]!.data.length;
          if (global <= o + len) return { node: nodes[i]!, offset: global - o };
        }
        const last = nodes[nodes.length - 1]!;
        return { node: last, offset: last.data.length };
      }
      const s = locate(start);
      const e = locate(end);
      const range = document.createRange();
      range.setStart(s.node, s.offset);
      range.setEnd(e.node, e.offset);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    },
    { selector, start, length },
  );
}

test.describe('LawViewer — Issue [A] regressions', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
    // Stash on the test for downstream inspection
    (page as unknown as { _mockState: typeof state })._mockState = state;
  });

  test('#2 body renders both 第一条 and 第二条 on direct navigation', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');
    await expect(page.locator('[data-anchor="条2/頭"]')).toHaveText('第二条');
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toContainText(SENTENCE_1);
    await expect(page.locator('[data-anchor="条2/項1/文1"]')).toContainText(SENTENCE_2);
  });

  test('#11 SelectionMenu color chips have no transition/animation classes', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toBeVisible();

    await selectTextRange(page, '[data-anchor="条1/項1/文1"]', 0, 4);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const chipClassLists = await dialog.locator('button[title^="マーカー"]').evaluateAll(
      (buttons) => buttons.map((b) => b.className),
    );
    expect(chipClassLists.length).toBeGreaterThan(0);
    for (const cls of chipClassLists) {
      expect(cls).not.toMatch(/\btransition\b/);
      expect(cls).not.toMatch(/\bhover:scale-/);
      expect(cls).not.toMatch(/\banimate-/);
    }
  });

  test('#5 create marker → click span → EditSelectionMenu → delete removes the highlight', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toBeVisible();

    // Select the first 4 chars of sentence 1 and pick the yellow marker
    await selectTextRange(page, '[data-anchor="条1/項1/文1"]', 0, 4);
    const menu = page.getByRole('dialog');
    await expect(menu).toBeVisible();
    await menu.locator('button[title^="マーカー 黄"]').click();

    const span = page.locator('span[data-sel-uuid]').first();
    await expect(span).toHaveCount(1);
    const beforeUuid = await span.getAttribute('data-sel-uuid');
    expect(beforeUuid).toBeTruthy();

    // Click the span -> EditSelectionMenu opens with 削除 button
    await span.click();
    const editMenu = page.getByRole('dialog');
    await expect(editMenu).toBeVisible();
    await editMenu.getByRole('button', { name: '削除' }).click();

    // Span gone after deletion + refetch
    await expect(page.locator('span[data-sel-uuid]')).toHaveCount(0);
  });

  test('#5 overlap pruning: new same-kind marker over the same text replaces the older one', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toBeVisible();

    // 1st marker: yellow over chars [0,4)
    await selectTextRange(page, '[data-anchor="条1/項1/文1"]', 0, 4);
    await page.getByRole('dialog').locator('button[title^="マーカー 黄"]').click();
    await expect(page.locator('span[data-sel-uuid]')).toHaveCount(1);
    const firstUuid = (await page.locator('span[data-sel-uuid]').first().getAttribute('data-sel-uuid'))!;

    // 2nd marker: green over chars [0,6) — overlaps [0,4)
    await selectTextRange(page, '[data-anchor="条1/項1/文1"]', 0, 6);
    await page.getByRole('dialog').locator('button[title^="マーカー 緑"]').click();

    // After overlap pruning, the older marker must be gone and exactly one remains.
    await expect(page.locator(`span[data-sel-uuid="${firstUuid}"]`)).toHaveCount(0);
    await expect(page.locator('span[data-sel-uuid]')).toHaveCount(1);
  });

  test('#5 marker + underline coexist (different kinds, no pruning)', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toBeVisible();

    // Marker yellow over [0,4)
    await selectTextRange(page, '[data-anchor="条1/項1/文1"]', 0, 4);
    await page.getByRole('dialog').locator('button[title^="マーカー 黄"]').click();
    await expect(page.locator('span[data-sel-uuid]')).toHaveCount(1);

    // Underline red over the same [0,4) — different kind, must coexist
    await selectTextRange(page, '[data-anchor="条1/項1/文1"]', 0, 4);
    await page.getByRole('dialog').locator('button[title^="下線 赤"]').click();
    await expect(page.locator('span[data-sel-uuid]')).toHaveCount(2);
  });

  // ===== Issue #2 — tab switching regression =====================================
  // The reported symptom: open 民法 (or any non-憲法 law) first, then switch
  // to 憲法; the body shows only partially. We assert that after switching,
  // every node of the new law renders (preamble + both articles).

  test('#2 tab switch LAW → KENPO renders preamble and all articles', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');

    // Navigate to the 憲法-shaped law (simulates clicking a tab).
    await page.goto(`/law/${KENPO_LAW_ID}`);

    // Wait for the new law's heading to take over the sticky header.
    await expect(page.getByRole('heading', { level: 1, name: KENPO_LAW_TITLE })).toBeVisible();

    // Preamble must render in full.
    const preamble = page.locator('[data-anchor="前0"]');
    await expect(preamble).toBeVisible();
    await expect(preamble).toContainText(KENPO_PREAMBLE_SENTENCE);

    // Both articles must render — last article being the regression canary.
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toContainText(KENPO_ARTICLE_1);
    await expect(page.locator('[data-anchor="条103/頭"]')).toHaveText('第百三条');
    await expect(page.locator('[data-anchor="条103/項1/文1"]')).toContainText(KENPO_ARTICLE_103);

    // The old law's anchor must not leak into the new view.
    await expect(page.locator('[data-anchor="条2/頭"]')).toHaveCount(0);
  });

  test('#2 tab switch LAW → real-憲法 renders preamble + 第一条 + 第百三条 (real e-Gov body)', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');

    // Tab-switch to the real Constitution body
    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="題名"]')).toHaveText('日本国憲法');

    // Preamble (4 paragraphs) must render in full
    const preamble = page.locator('[data-anchor="前0"]');
    await expect(preamble).toBeVisible();
    await expect(preamble.locator('[data-anchor="前0/項1/文1"]')).toContainText('日本国民は、正当に選挙された国会');
    await expect(preamble.locator('[data-anchor="前0/項2/文1"]')).toContainText('恒久の平和を念願');
    await expect(preamble.locator('[data-anchor="前0/項3/文1"]')).toContainText('いづれの国家も');
    await expect(preamble.locator('[data-anchor="前0/項4/文1"]')).toContainText('国家の名誉にかけ');

    // First article
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toContainText('天皇は、日本国の象徴');

    // Final article must also be present (regression canary)
    await expect(page.locator('[data-anchor="条103/頭"]')).toHaveText('第百三条');
    await expect(page.locator('[data-anchor="条103/項1/文1"]')).toContainText('この憲法施行');
  });

  test('#2 SPA tab click: real-憲法 body renders after switching back via LawTabs', async ({ page }) => {
    // Open both tabs via direct navigation (full-load on each)
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');

    await page.goto(`/law/${REAL_KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="題名"]')).toHaveText('日本国憲法');

    // Now both tabs exist in localStorage. Click the LAW tab via SPA nav,
    // then click 憲法 tab — this is the path the user actually walks.
    const lawTab = page.locator('nav, .text-sm').locator('a').filter({ hasText: 'テスト法' }).first();
    await lawTab.click();
    await expect(page).toHaveURL(new RegExp(`/law/${LAW_ID}$`));
    await expect(page.locator('[data-anchor="条1/頭"]')).toHaveText('第一条');

    const kenpoTab = page.locator('nav, .text-sm').locator('a').filter({ hasText: '日本国憲法' }).first();
    await kenpoTab.click();
    await expect(page).toHaveURL(new RegExp(`/law/${REAL_KENPO_LAW_ID}$`));

    // Now the canary: every part of the real 憲法 body must render after SPA switch.
    await expect(page.locator('[data-anchor="題名"]')).toHaveText('日本国憲法');
    const preamble = page.locator('[data-anchor="前0"]');
    await expect(preamble).toBeVisible();
    await expect(preamble.locator('[data-anchor="前0/項1/文1"]')).toContainText('日本国民は、正当に選挙された国会');
    await expect(preamble.locator('[data-anchor="前0/項4/文1"]')).toContainText('国家の名誉にかけ');
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toContainText('天皇は、日本国の象徴');
    await expect(page.locator('[data-anchor="条103/項1/文1"]')).toContainText('この憲法施行');
  });

  test('#2 ping-pong: LAW → KENPO → LAW → KENPO keeps both bodies intact', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toContainText(SENTENCE_1);
    await expect(page.locator('[data-anchor="条2/項1/文1"]')).toContainText(SENTENCE_2);

    await page.goto(`/law/${KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="前0"]')).toContainText(KENPO_PREAMBLE_SENTENCE);
    await expect(page.locator('[data-anchor="条103/項1/文1"]')).toContainText(KENPO_ARTICLE_103);

    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toContainText(SENTENCE_1);
    await expect(page.locator('[data-anchor="条2/項1/文1"]')).toContainText(SENTENCE_2);
    await expect(page.locator('[data-anchor="前0"]')).toHaveCount(0);

    await page.goto(`/law/${KENPO_LAW_ID}`);
    await expect(page.locator('[data-anchor="前0"]')).toContainText(KENPO_PREAMBLE_SENTENCE);
    await expect(page.locator('[data-anchor="条103/項1/文1"]')).toContainText(KENPO_ARTICLE_103);
  });
});
