import { describe, it, expect } from 'vitest';
import {
  parseEnforcementDate,
  computeRevisionStatus,
} from './revision.js';

describe('parseEnforcementDate', () => {
  it('parses YYYYMMDD from a 3-part filename', () => {
    const d = parseEnforcementDate('129AC0000000089_20260401_506AC0000000033');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(3); // April = 3
    expect(d!.getUTCDate()).toBe(1);
  });

  it('parses憲法-style "0..." amendment id', () => {
    const d = parseEnforcementDate('321CONSTITUTION_19470503_000000000000000');
    expect(d!.getUTCFullYear()).toBe(1947);
    expect(d!.getUTCMonth()).toBe(4); // May
    expect(d!.getUTCDate()).toBe(3);
  });

  it('returns null when there is no date segment', () => {
    expect(parseEnforcementDate('129AC0000000089')).toBeNull();
  });

  it('returns null when the date segment is not 8 digits', () => {
    expect(parseEnforcementDate('foo_2024_bar')).toBeNull();
    expect(parseEnforcementDate('foo_20240230_bar')).toBeNull(); // Feb 30
  });
});

describe('computeRevisionStatus', () => {
  const today = new Date(Date.UTC(2026, 4, 29)); // 2026-05-29 (project today)

  // 民法 — two known revisions in the Catalystwo dump
  const minpoCurrent = '129AC0000000089_20260401_506AC0000000033'; // 2026-04-01
  const minpoOlder = '129AC0000000089_20240524_506AC0000000033'; // 2024-05-24

  it('latest in-force revision → 現行最新', () => {
    expect(
      computeRevisionStatus(minpoCurrent, [minpoCurrent, minpoOlder], today),
    ).toBe('current');
  });

  it('older revision when a newer in-force exists → 過去法', () => {
    expect(
      computeRevisionStatus(minpoOlder, [minpoCurrent, minpoOlder], today),
    ).toBe('past');
  });

  it('施行日 > today → 未施行', () => {
    const futureRev = '129AC0000000089_20270401_xxx';
    expect(
      computeRevisionStatus(futureRev, [futureRev, minpoCurrent], today),
    ).toBe('future');
  });

  it('single known revision is always 現行最新', () => {
    expect(computeRevisionStatus(minpoCurrent, [minpoCurrent], today)).toBe(
      'current',
    );
  });

  it('a future sibling does NOT demote an in-force revision', () => {
    const futureRev = '129AC0000000089_20270401_xxx';
    expect(
      computeRevisionStatus(minpoCurrent, [minpoCurrent, futureRev], today),
    ).toBe('current');
  });

  it('siblings whose filename does not encode a date are ignored', () => {
    expect(
      computeRevisionStatus(
        minpoCurrent,
        [minpoCurrent, '129AC0000000089'],
        today,
      ),
    ).toBe('current');
  });

  it('unparseable target filename falls back to 現行最新', () => {
    expect(computeRevisionStatus('129AC0000000089', [], today)).toBe('current');
  });
});
