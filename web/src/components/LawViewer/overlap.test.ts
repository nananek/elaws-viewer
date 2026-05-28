import { describe, it, expect } from 'vitest';
import { findOverlappingOlder } from './overlap.js';
import type { SelectionObject } from '@elaws/shared/types';

function sel(over: Partial<SelectionObject>): SelectionObject {
  return {
    uuid: 'u-existing',
    lawNo: 'L',
    style: 0,
    row: 10,
    startIndexInRow: 5,
    startAnchor: '条1/項1/文1',
    endAnchor: '条1/項1/文1',
    startString: '善管',
    startStringOccurrenceIndex: 0,
    endString: null,
    notes: null,
    embeddedObjectTextRep: null,
    hasEmbeddedObject: false,
    hasAttributedString: false,
    isDeleted: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('findOverlappingOlder', () => {
  const newIncoming = {
    uuid: 'u-new',
    style: 0, // marker
    row: 10,
    startAnchor: '条1/項1/文1',
    startIndexInRow: 5,
    startString: '善管注意',
    updatedAt: '2026-05-29T00:00:00.000Z',
  };

  it('returns empty when no existing selections', () => {
    expect(findOverlappingOlder([], newIncoming)).toEqual([]);
  });

  it('prunes same-kind (marker vs marker) older selection that overlaps interval', () => {
    const existing = [sel({ uuid: 'u-old', style: 1 /* marker green */ })];
    const victims = findOverlappingOlder(existing, newIncoming);
    expect(victims).toHaveLength(1);
    expect(victims[0]!.uuid).toBe('u-old');
  });

  it('does NOT prune across kinds (marker vs underline coexists)', () => {
    const existing = [sel({ uuid: 'u-underline', style: 5 /* underline red */ })];
    expect(findOverlappingOlder(existing, newIncoming)).toEqual([]);
  });

  it('does NOT prune underline vs marker when incoming is underline', () => {
    const existing = [sel({ uuid: 'u-marker', style: 0 })];
    const underlineIncoming = { ...newIncoming, style: 5 };
    expect(findOverlappingOlder(existing, underlineIncoming)).toEqual([]);
  });

  it('prunes underline-vs-underline overlap', () => {
    const existing = [sel({ uuid: 'u-old-ul', style: 6 /* underline blue */ })];
    const underlineIncoming = { ...newIncoming, style: 7 /* underline green */ };
    expect(findOverlappingOlder(existing, underlineIncoming)).toHaveLength(1);
  });

  it('respects startAnchor: different anchor = no overlap', () => {
    const existing = [sel({ startAnchor: '条1/項1/文2' })];
    expect(findOverlappingOlder(existing, newIncoming)).toEqual([]);
  });

  it('respects row: different row = no overlap', () => {
    const existing = [sel({ row: 11 })];
    expect(findOverlappingOlder(existing, newIncoming)).toEqual([]);
  });

  it('uses half-open interval: [5,9) and [9,12) do NOT overlap', () => {
    // existing: index 9, length 3 → [9, 12)
    // incoming: index 5, length 4 (善管注意) → [5, 9)
    const existing = [sel({ startIndexInRow: 9, startString: 'abc' })];
    expect(findOverlappingOlder(existing, newIncoming)).toEqual([]);
  });

  it('detects partial overlap [5,9) vs [8,11)', () => {
    const existing = [sel({ startIndexInRow: 8, startString: 'xyz' })];
    expect(findOverlappingOlder(existing, newIncoming)).toHaveLength(1);
  });

  it('detects full containment [5,9) contains [6,8)', () => {
    const existing = [sel({ startIndexInRow: 6, startString: 'ab' })];
    expect(findOverlappingOlder(existing, newIncoming)).toHaveLength(1);
  });

  it('skips deleted selections', () => {
    const existing = [sel({ isDeleted: true })];
    expect(findOverlappingOlder(existing, newIncoming)).toEqual([]);
  });

  it('skips self by uuid', () => {
    const existing = [sel({ uuid: 'u-new' })];
    expect(findOverlappingOlder(existing, newIncoming)).toEqual([]);
  });

  it('does NOT prune newer existing (keeps the newer one)', () => {
    const existing = [sel({ updatedAt: '2027-01-01T00:00:00.000Z' })];
    expect(findOverlappingOlder(existing, newIncoming)).toEqual([]);
  });

  it('returns multiple victims when several older selections overlap', () => {
    const existing = [
      sel({ uuid: 'u-a', startIndexInRow: 4, startString: 'ab' }), // [4,6) — overlaps [5,9)
      sel({ uuid: 'u-b', startIndexInRow: 7, startString: 'cd' }), // [7,9) — overlaps [5,9)
      sel({ uuid: 'u-c', startIndexInRow: 20, startString: 'ef' }), // [20,22) — no overlap
    ];
    const victims = findOverlappingOlder(existing, newIncoming).map((v) => v.uuid).sort();
    expect(victims).toEqual(['u-a', 'u-b']);
  });

  it('returns empty for unknown style number (defensive)', () => {
    const existing = [sel({})];
    const weird = { ...newIncoming, style: 999 };
    expect(findOverlappingOlder(existing, weird)).toEqual([]);
  });
});
