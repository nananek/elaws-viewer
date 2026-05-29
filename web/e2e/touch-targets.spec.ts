import { expect, test } from '@playwright/test';
import { LAW_ID, REAL_MINPO_LAW_ID, createMockState, installApiMocks } from './fixtures.js';

/**
 * Touch-target audit (Apple HIG / Material guidance ≥ 44 px).
 *
 * Why a real measurement instead of asserting class names: the renderer
 * frequently wraps overlay spans around the selection, and Tailwind's
 * arbitrary classes don't always compose to the size the eye sees. We
 * measure the actual bounding rect so the test fails when CSS regresses.
 */

const MIN_TAP = 44;

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
      const e = locate(start + length);
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

test.describe('Touch target sizes (≥ 44 px)', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  test('SelectionMenu color chips are at least 44×44 px', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toBeVisible();

    await selectTextRange(page, '[data-anchor="条1/項1/文1"]', 0, 4);
    const menu = page.getByTestId('selection-menu');
    await expect(menu).toBeVisible();

    const chips = menu.locator('[data-testid^="style-chip-"]');
    const count = await chips.count();
    expect(count).toBe(14); // 7 markers + 7 underlines

    for (let i = 0; i < count; i++) {
      const box = await chips.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width, `chip #${i} width`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box!.height, `chip #${i} height`).toBeGreaterThanOrEqual(MIN_TAP);
    }

    const dismiss = menu.getByTestId('selection-menu-dismiss');
    const dbox = await dismiss.boundingBox();
    expect(dbox!.width).toBeGreaterThanOrEqual(MIN_TAP);
    expect(dbox!.height).toBeGreaterThanOrEqual(MIN_TAP);
  });

  test('EditSelectionMenu chips + delete + dismiss are all ≥ 44 px', async ({ page }) => {
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toBeVisible();

    // Create a marker first, then click it to open EditSelectionMenu
    await selectTextRange(page, '[data-anchor="条1/項1/文1"]', 0, 4);
    await page.getByTestId('selection-menu').getByTestId('style-chip-0').click();

    const span = page.locator('span[data-sel-uuid]').first();
    await expect(span).toHaveCount(1);
    await span.click();

    const menu = page.getByTestId('edit-selection-menu');
    await expect(menu).toBeVisible();

    const chips = menu.locator('[data-testid^="edit-style-chip-"]');
    const count = await chips.count();
    expect(count).toBe(14);
    for (let i = 0; i < count; i++) {
      const box = await chips.nth(i).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP);
    }
    const del = menu.getByTestId('edit-selection-delete');
    const delBox = await del.boundingBox();
    expect(delBox!.height).toBeGreaterThanOrEqual(MIN_TAP);
    const dismiss = menu.getByTestId('edit-selection-dismiss');
    const dBox = await dismiss.boundingBox();
    expect(dBox!.width).toBeGreaterThanOrEqual(MIN_TAP);
    expect(dBox!.height).toBeGreaterThanOrEqual(MIN_TAP);
  });

  test('AnchorJumpModal keypad buttons are at least 44 px tall', async ({ page }) => {
    await page.goto(`/law/${REAL_MINPO_LAW_ID}`);
    await page.locator('[data-anchor="条1/頭"]').waitFor({ state: 'visible' });

    await page.locator('body').press('=');
    const modal = page.getByTestId('anchor-jump-modal');
    await expect(modal).toBeVisible();

    const buttons = modal.locator('[data-testid="keypad"] button');
    const n = await buttons.count();
    expect(n).toBeGreaterThan(10);
    for (let i = 0; i < n; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box, `button #${i}`).not.toBeNull();
      expect(box!.height, `button #${i} height`).toBeGreaterThanOrEqual(MIN_TAP);
    }
  });
});

test.describe('Markup popup placement on coarse pointer', () => {
  test.beforeEach(async ({ page }) => {
    const state = createMockState();
    await installApiMocks(page, state);
  });

  // Why coarse-pointer specifically: on iPad Safari the system selection
  // callout (Copy / Look Up / Share) sits directly above the selection
  // rect. If our popup also goes "above", the two collide. Force the
  // emulated pointer to coarse and assert popup top is below the
  // selection.
  test.use({ hasTouch: true });

  test('with pointer:coarse, popup is positioned BELOW the selection rect', async ({ page }) => {
    // matchMedia('pointer: coarse') needs the engine to report coarse;
    // hasTouch alone makes it report coarse: true in Chromium.
    await page.goto(`/law/${LAW_ID}`);
    await expect(page.locator('[data-anchor="条1/項1/文1"]')).toBeVisible();

    // Sanity: confirm the emulated env actually reports coarse pointer
    const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
    expect(coarse).toBe(true);

    await selectTextRange(page, '[data-anchor="条1/項1/文1"]', 0, 4);
    const menu = page.getByTestId('selection-menu');
    await expect(menu).toBeVisible();

    const menuBox = await menu.boundingBox();
    const selBox = await page.locator('[data-anchor="条1/項1/文1"]').boundingBox();
    expect(menuBox).not.toBeNull();
    expect(selBox).not.toBeNull();
    // Popup TOP must be at or below the selection element's BOTTOM (with
    // a small tolerance) — i.e. the popup is rendered downstream.
    expect(menuBox!.y).toBeGreaterThanOrEqual(selBox!.y + selBox!.height - 2);
  });
});
