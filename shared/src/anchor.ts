/**
 * Anchor notation for in-law positions.
 * Examples:
 *   条N/頭        — head of article N (article number itself)
 *   条N/項M/文K   — article N, paragraph M, sentence K
 *   条N_M         — sub-article N-M
 *   前0/項M/文K   — preamble paragraph M sentence K
 */

export interface ParsedAnchor {
  kind: 'article' | 'preamble';
  /** Article number (e.g. "400" or "2_7"). null for preamble. */
  article: string | null;
  /** "頭" or null when not "頭" form */
  head: boolean;
  /** Paragraph number, null if not specified */
  paragraph: number | null;
  /** Sentence number, null if not specified */
  sentence: number | null;
}

const KANJI_DIGITS: Record<string, number> = {
  '〇': 0, 'ゼロ': 0, '零': 0,
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9,
};

/**
 * Convert Japanese numeric expressions to integer.
 * Supports "百二十三" / "二十" / "十" / mixed kanji+arabic.
 * Returns null when not parseable.
 */
export function kanjiToNumber(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);

  let total = 0;
  let current = 0;
  for (const ch of s) {
    if (/\d/.test(ch)) {
      current = current * 10 + parseInt(ch, 10);
    } else if (ch === '千') {
      total += (current || 1) * 1000;
      current = 0;
    } else if (ch === '百') {
      total += (current || 1) * 100;
      current = 0;
    } else if (ch === '十') {
      total += (current || 1) * 10;
      current = 0;
    } else if (KANJI_DIGITS[ch] !== undefined) {
      current = KANJI_DIGITS[ch]!;
    } else {
      return null;
    }
  }
  return total + current;
}

/**
 * Normalize user input like "123", "第百二十三条", "2の7", "第二条の七"
 * into an article key string ("123" or "2_7").
 * Returns null when not parseable.
 */
export function normalizeArticleInput(input: string): string | null {
  const s = input.trim().replace(/\s+/g, '');
  if (!s) return null;

  // "第A条のB" / "第A条" / "A条のB" / "A条"
  const m = s.match(/^第?(.+?)条(?:の(.+))?$/);
  if (m) {
    const main = kanjiToNumber(m[1]!);
    if (main == null) return null;
    if (m[2]) {
      const sub = kanjiToNumber(m[2]);
      if (sub == null) return null;
      return `${main}_${sub}`;
    }
    return String(main);
  }

  // No 条 — accept "AのB", "A_B", "A-B", "A"
  const parts = s.split(/[の_\-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const nums = parts.map((p) => kanjiToNumber(p));
  if (nums.some((n) => n === null)) return null;
  return nums.join('_');
}

export function formatAnchor(p: Partial<ParsedAnchor>): string {
  if (p.kind === 'preamble') {
    let s = '前0';
    if (p.paragraph != null) s += `/項${p.paragraph}`;
    if (p.sentence != null) s += `/文${p.sentence}`;
    return s;
  }
  let s = `条${p.article ?? ''}`;
  if (p.head) s += '/頭';
  if (p.paragraph != null) s += `/項${p.paragraph}`;
  if (p.sentence != null) s += `/文${p.sentence}`;
  return s;
}

export function parseAnchor(anchor: string): ParsedAnchor | null {
  if (anchor.startsWith('前')) {
    const m = anchor.match(/^前0(?:\/項(\d+))?(?:\/文(\d+))?$/);
    if (!m) return null;
    return {
      kind: 'preamble',
      article: null,
      head: false,
      paragraph: m[1] ? parseInt(m[1], 10) : null,
      sentence: m[2] ? parseInt(m[2], 10) : null,
    };
  }
  const m = anchor.match(/^条([\d_]+)(?:\/(頭|項(\d+)(?:\/文(\d+))?))?$/);
  if (!m) return null;
  const article = m[1]!;
  const tail = m[2];
  return {
    kind: 'article',
    article,
    head: tail === '頭',
    paragraph: m[3] ? parseInt(m[3], 10) : null,
    sentence: m[4] ? parseInt(m[4], 10) : null,
  };
}

/** Return the article-level prefix (drops 項/文/頭). e.g. "条400/項1/文1" → "条400" */
export function anchorArticleKey(anchor: string): string | null {
  const p = parseAnchor(anchor);
  if (!p) return null;
  if (p.kind === 'preamble') return '前0';
  return `条${p.article}`;
}
