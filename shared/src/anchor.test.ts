import { describe, it, expect } from 'vitest';
import {
  kanjiToNumber,
  normalizeArticleInput,
  parseAnchor,
  formatAnchor,
  anchorArticleKey,
  buildCompoundAnchor,
  anchorFallbackChain,
  formatNaturalAnchor,
} from './anchor.js';

describe('kanjiToNumber', () => {
  it.each([
    ['一', 1],
    ['十', 10],
    ['二十', 20],
    ['二十三', 23],
    ['百', 100],
    ['百二十三', 123],
    ['千二百三十四', 1234],
    ['123', 123],
    ['0', 0],
  ])('%s -> %d', (input, expected) => {
    expect(kanjiToNumber(input)).toBe(expected);
  });

  it('returns null for garbage', () => {
    expect(kanjiToNumber('abc')).toBe(null);
  });
});

describe('normalizeArticleInput', () => {
  it.each([
    ['123', '123'],
    ['第百二十三条', '123'],
    ['2の7', '2_7'],
    ['第二条の七', '2_7'],
    ['400', '400'],
    ['第400条', '400'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeArticleInput(input)).toBe(expected);
  });

  it('returns null for empty', () => {
    expect(normalizeArticleInput('')).toBe(null);
  });
});

describe('parseAnchor / formatAnchor', () => {
  it('round-trips article', () => {
    const p = parseAnchor('条400/項1/文1');
    expect(p).toEqual({
      kind: 'article', article: '400', head: false, paragraph: 1, sentence: 1,
    });
    expect(formatAnchor(p!)).toBe('条400/項1/文1');
  });

  it('round-trips 頭', () => {
    const p = parseAnchor('条576/頭');
    expect(p!.head).toBe(true);
    expect(formatAnchor(p!)).toBe('条576/頭');
  });

  it('parses sub-article', () => {
    const p = parseAnchor('条2_7/項1');
    expect(p!.article).toBe('2_7');
  });

  it('parses preamble', () => {
    const p = parseAnchor('前0/項1/文1');
    expect(p!.kind).toBe('preamble');
    expect(p!.paragraph).toBe(1);
    expect(p!.sentence).toBe(1);
  });
});

describe('anchorArticleKey', () => {
  it('strips paragraph/sentence', () => {
    expect(anchorArticleKey('条400/項1/文2')).toBe('条400');
    expect(anchorArticleKey('条576/頭')).toBe('条576');
    expect(anchorArticleKey('前0/項1/文1')).toBe('前0');
  });
});

describe('buildCompoundAnchor', () => {
  it('builds plain article', () => {
    expect(buildCompoundAnchor({ article: 400 })).toBe('条400');
  });
  it('builds sub-article (枝条)', () => {
    expect(buildCompoundAnchor({ article: 576, of: 2 })).toBe('条576_2');
  });
  it('builds article + paragraph + 号', () => {
    expect(
      buildCompoundAnchor({ article: 2, paragraph: 1, item: 3 }),
    ).toBe('条2/項1/号3');
  });
  it('builds article + paragraph only', () => {
    expect(buildCompoundAnchor({ article: 400, paragraph: 1 })).toBe('条400/項1');
  });
  it('builds sub-article + 項 + 号', () => {
    expect(
      buildCompoundAnchor({ article: 2, of: 3, paragraph: 1, item: 5 }),
    ).toBe('条2_3/項1/号5');
  });
  it('null values are ignored', () => {
    expect(
      buildCompoundAnchor({ article: 5, of: null, paragraph: null, item: null }),
    ).toBe('条5');
  });
});

describe('formatNaturalAnchor', () => {
  it('formats plain article', () => {
    expect(formatNaturalAnchor({ article: 400 })).toBe('第400条');
  });
  it('formats sub-article', () => {
    expect(formatNaturalAnchor({ article: 899, of: 2 })).toBe('第899条の2');
  });
  it('formats sub-article + 項', () => {
    expect(formatNaturalAnchor({ article: 899, of: 2, paragraph: 1 })).toBe(
      '第899条の2 第1項',
    );
  });
  it('formats article + 項 + 号', () => {
    expect(formatNaturalAnchor({ article: 2, paragraph: 1, item: 3 })).toBe(
      '第2条 第1項第3号',
    );
  });
  it('formats sub-article + 項 + 号', () => {
    expect(
      formatNaturalAnchor({ article: 2, of: 3, paragraph: 1, item: 5 }),
    ).toBe('第2条の3 第1項第5号');
  });
});

describe('anchorFallbackChain', () => {
  it('drops 号 then 項 then 枝条 then base', () => {
    expect(anchorFallbackChain('条2_3/項1/号5')).toEqual([
      '条2_3/項1/号5',
      '条2_3/項1',
      '条2_3',
      '条2',
    ]);
  });
  it('drops 項 then base for plain article', () => {
    expect(anchorFallbackChain('条400/項1')).toEqual(['条400/項1', '条400']);
  });
  it('single-element for bare 条', () => {
    expect(anchorFallbackChain('条400')).toEqual(['条400']);
  });
  it('handles sub-article alone', () => {
    expect(anchorFallbackChain('条576_2')).toEqual(['条576_2', '条576']);
  });
});
