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

describe('anchorDom — definition-list paragraphs render horizontally (PR-D reversal of Phase 10 PR B vertical-rl)', () => {
  it('会社法 第二条 項1 paragraph carries NO data-vertical attribute', () => {
    const body = loadKaisha();
    const html = render(body.nodes);
    const match = html.match(/data-anchor="条2\/項1"[^>]*/);
    expect(match).toBeTruthy();
    expect(match![0]).not.toMatch(/data-vertical/);
  });

  it('会社法 第一条 項1 paragraph also has no data-vertical', () => {
    const body = loadKaisha();
    const html = render(body.nodes);
    const match = html.match(/data-anchor="条1\/項1"[^>]*/);
    expect(match).toBeTruthy();
    expect(match![0]).not.toMatch(/data-vertical/);
  });
});
