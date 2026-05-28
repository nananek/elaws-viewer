import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LawBody, LawNode } from '@elaws/shared/types';
import { renderNode } from './anchorDom.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadKaisha(): LawBody {
  // Real e-Gov 会社法 (slimmed to 第一条 + 第二条). 著作権法 13 条で対象外。
  const p = resolve(__dirname, '..', '..', '..', 'e2e', 'fixtures', 'kaisha-body.json');
  return JSON.parse(readFileSync(p, 'utf-8')) as LawBody;
}

function render(nodes: LawNode[]): string {
  return renderToStaticMarkup(<>{nodes.map((n) => renderNode(n))}</>);
}

describe('anchorDom — depth-aware item nesting (Issue #3)', () => {
  it('会社法 第二条三号の二 yields nested Subitem blocks (not flex siblings)', () => {
    const body = loadKaisha();
    const html = render(body.nodes);

    // Parent item — depth 0
    expect(html).toMatch(/data-anchor="条2\/項1\/号4"[^>]*data-depth="0"/);
    // Subitems (イ / ロ) — depth 1
    expect(html).toMatch(/data-anchor="条2\/項1\/号4\/小1"[^>]*data-depth="1"/);
    expect(html).toMatch(/data-anchor="条2\/項1\/号4\/小2"[^>]*data-depth="1"/);

    // Regression guard: the old layout was `<div class="flex gap-2 pl-8">`.
    // The new item container must NOT use flex, otherwise Subitems become
    // horizontal siblings (the bug from Issue #3).
    const itemDivMatch = html.match(/<div data-anchor="条2\/項1\/号4"[^>]*class="([^"]*)"/);
    expect(itemDivMatch?.[1] ?? '').not.toMatch(/\bflex\b/);
  });
});

describe('anchorDom — definition-list vertical layout (Issue #3)', () => {
  it('会社法 第二条 项1 paragraph is tagged data-vertical="1" (≥4 items, each begins 「)', () => {
    const body = loadKaisha();
    const html = render(body.nodes);
    expect(html).toMatch(/data-anchor="条2\/項1"[^>]*data-vertical="1"/);
  });

  it('会社法 第一条 项1 paragraph is NOT tagged data-vertical (regular prose, not a definition list)', () => {
    const body = loadKaisha();
    const html = render(body.nodes);
    const match = html.match(/data-anchor="条1\/項1"[^>]*/);
    expect(match).toBeTruthy();
    expect(match![0]).not.toMatch(/data-vertical/);
  });

  it('synthetic: ≥4 items but one not starting with 「 → no data-vertical', () => {
    const node: LawNode = {
      anchor: '条99/項1',
      row: 1,
      kind: 'paragraph',
      text: '',
      children: [
        item('条99/項1/号1', 'イ', '「定義1」とは…'),
        item('条99/項1/号2', 'ロ', '「定義2」とは…'),
        item('条99/項1/号3', 'ハ', '「定義3」とは…'),
        item('条99/項1/号4', 'ニ', '普通の文'),
      ],
    };
    const html = render([node]);
    expect(html).not.toMatch(/data-vertical/);
  });

  it('synthetic: only 3 items, all starting with 「 → no data-vertical (need ≥4)', () => {
    const node: LawNode = {
      anchor: '条98/項1',
      row: 1,
      kind: 'paragraph',
      text: '',
      children: [
        item('条98/項1/号1', '一', '「A」'),
        item('条98/項1/号2', '二', '「B」'),
        item('条98/項1/号3', '三', '「C」'),
      ],
    };
    const html = render([node]);
    expect(html).not.toMatch(/data-vertical/);
  });
});

function item(anchor: string, title: string, sentenceText: string): LawNode {
  return {
    anchor,
    row: 0,
    kind: 'item',
    text: '',
    children: [
      { anchor: `${anchor}/番号`, row: 0, kind: 'itemTitle', text: title },
      { anchor: `${anchor}/文1`, row: 0, kind: 'itemSentence', text: sentenceText },
    ],
  };
}
