import { describe, expect, it, afterEach } from 'vitest';
import { subscribeChanges, publishChange, type ChangeEvent } from './events.js';

describe('change-event bus', () => {
  const unsubs: Array<() => void> = [];

  afterEach(() => {
    while (unsubs.length) unsubs.pop()?.();
  });

  it('fans an event out to every subscriber', () => {
    const calls1: ChangeEvent[] = [];
    const calls2: ChangeEvent[] = [];
    unsubs.push(subscribeChanges((e) => calls1.push(e)));
    unsubs.push(subscribeChanges((e) => calls2.push(e)));

    publishChange({ resource: 'selections', lawNo: '民法', clientId: 'c1' });
    publishChange({ resource: 'tags', clientId: 'c2' });

    expect(calls1).toEqual([
      { resource: 'selections', lawNo: '民法', clientId: 'c1' },
      { resource: 'tags', clientId: 'c2' },
    ]);
    expect(calls2).toEqual(calls1);
  });

  it('unsubscribe stops further deliveries to that listener only', () => {
    const a: ChangeEvent[] = [];
    const b: ChangeEvent[] = [];
    const unsubA = subscribeChanges((e) => a.push(e));
    unsubs.push(subscribeChanges((e) => b.push(e)));

    publishChange({ resource: 'bookmarks', clientId: null });
    unsubA();
    publishChange({ resource: 'folders', clientId: null });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);
  });

  it('a listener that throws does not stop other listeners or the publish call', () => {
    const survived: ChangeEvent[] = [];
    unsubs.push(
      subscribeChanges(() => {
        throw new Error('boom');
      }),
    );
    unsubs.push(subscribeChanges((e) => survived.push(e)));

    expect(() =>
      publishChange({ resource: 'tags', clientId: null }),
    ).not.toThrow();
    expect(survived).toHaveLength(1);
  });
});
