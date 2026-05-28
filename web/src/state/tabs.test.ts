import { describe, it, expect, beforeEach } from 'vitest';
import { useTabs } from './tabs.js';

function reset() {
  useTabs.setState({ tabs: [] });
}

describe('useTabs.move', () => {
  beforeEach(() => {
    reset();
    const { open } = useTabs.getState();
    open({ lawId: 'A', title: 'A' });
    open({ lawId: 'B', title: 'B' });
    open({ lawId: 'C', title: 'C' });
    open({ lawId: 'D', title: 'D' });
  });

  it('moves a tab from index 0 to index 2', () => {
    useTabs.getState().move('A', 2);
    expect(useTabs.getState().tabs.map((t) => t.lawId)).toEqual([
      'B', 'C', 'A', 'D',
    ]);
  });

  it('moves a tab from index 3 to index 0', () => {
    useTabs.getState().move('D', 0);
    expect(useTabs.getState().tabs.map((t) => t.lawId)).toEqual([
      'D', 'A', 'B', 'C',
    ]);
  });

  it('clamps toIndex to last index', () => {
    useTabs.getState().move('A', 99);
    expect(useTabs.getState().tabs.map((t) => t.lawId)).toEqual([
      'B', 'C', 'D', 'A',
    ]);
  });

  it('clamps negative toIndex to 0', () => {
    useTabs.getState().move('C', -5);
    expect(useTabs.getState().tabs.map((t) => t.lawId)).toEqual([
      'C', 'A', 'B', 'D',
    ]);
  });

  it('no-op when fromLawId is unknown', () => {
    const before = useTabs.getState().tabs.map((t) => t.lawId);
    useTabs.getState().move('ZZZ', 1);
    expect(useTabs.getState().tabs.map((t) => t.lawId)).toEqual(before);
  });

  it('no-op when source and destination would be the same slot', () => {
    const before = useTabs.getState().tabs.map((t) => t.lawId);
    useTabs.getState().move('B', 1);
    expect(useTabs.getState().tabs.map((t) => t.lawId)).toEqual(before);
  });

  it('moving a tab one slot right places it after its right neighbor', () => {
    useTabs.getState().move('B', 2);
    expect(useTabs.getState().tabs.map((t) => t.lawId)).toEqual([
      'A', 'C', 'B', 'D',
    ]);
  });
});
