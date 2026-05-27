import { describe, it, expect } from 'vitest';
import {
  kanjiToNumber,
  normalizeArticleInput,
  parseAnchor,
  formatAnchor,
  anchorArticleKey,
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
