import type { LawBody, LawNode } from '@elaws/shared/types';

/**
 * Index of a law's article/paragraph/item structure, used by the テンキー modal
 * to decide whether the `.` separator can advance to the next field.
 *
 * Article anchors emitted by the parser are `条N` or `条N_M` (枝条).
 * Paragraph anchors are `条N/項P` or `条N_M/項P`.
 */
export interface LawIndex {
  /** For article N: sorted list of sub-article numbers M present in `条N_M`. */
  subArticles: Map<number, number[]>;
  /** For article key `"N"` or `"N_M"`: count of direct `paragraph` children. */
  paragraphCount: Map<string, number>;
  /** Indexed by paragraph anchor (`条N/項P` or `条N_M/項P`): count of `item` children. */
  itemCount: Map<string, number>;
}

export function buildLawIndex(body: LawBody): LawIndex {
  const subArticles = new Map<number, number[]>();
  const paragraphCount = new Map<string, number>();
  const itemCount = new Map<string, number>();

  function walk(n: LawNode): void {
    if (n.kind === 'article') {
      const m = n.anchor.match(/^条(\d+)(?:_(\d+))?$/);
      if (m) {
        const N = parseInt(m[1]!, 10);
        const articleKey = m[2] ? `${m[1]}_${m[2]}` : m[1]!;
        if (m[2]) {
          const M = parseInt(m[2], 10);
          const arr = subArticles.get(N) ?? [];
          arr.push(M);
          subArticles.set(N, arr);
        }
        const paragraphs = (n.children ?? []).filter((c) => c.kind === 'paragraph');
        paragraphCount.set(articleKey, paragraphs.length);
        for (const p of paragraphs) {
          const items = (p.children ?? []).filter((c) => c.kind === 'item');
          itemCount.set(p.anchor, items.length);
        }
      }
    }
    for (const c of n.children ?? []) walk(c);
  }
  for (const n of body.nodes) walk(n);

  for (const arr of subArticles.values()) arr.sort((a, b) => a - b);

  return { subArticles, paragraphCount, itemCount };
}

export function hasSubArticle(idx: LawIndex, articleN: number): boolean {
  return (idx.subArticles.get(articleN)?.length ?? 0) > 0;
}

export function hasMultipleParagraphs(idx: LawIndex, articleKey: string): boolean {
  return (idx.paragraphCount.get(articleKey) ?? 0) >= 2;
}

export function hasItemsForParagraph(
  idx: LawIndex,
  articleKey: string,
  paragraphNum: number,
): boolean {
  return (idx.itemCount.get(`条${articleKey}/項${paragraphNum}`) ?? 0) > 0;
}
