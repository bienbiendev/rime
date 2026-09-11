import { describe, expect, it } from 'vitest';
import { EDIT_LOCK_TTL_MS } from './constant.js';
import { isLockHeldByOther, isLockStale } from './lock.js';

const NOW = new Date('2026-01-01T12:00:00.000Z').getTime();
const ago = (ms: number) => new Date(NOW - ms);

const doc = (by: string | null, at: Date | string | null) =>
  ({ currentlyEditedBy: by, currentlyEditedAt: at }) as any;

describe('isLockStale', () => {
  it('is stale with no timestamp: a claim that cannot be aged is no claim', () => {
    expect(isLockStale(null, NOW)).toBe(true);
    expect(isLockStale(undefined, NOW)).toBe(true);
    expect(isLockStale('not a date', NOW)).toBe(true);
  });

  it('is fresh inside the TTL and stale on it', () => {
    expect(isLockStale(ago(EDIT_LOCK_TTL_MS - 1000), NOW)).toBe(false);
    expect(isLockStale(ago(EDIT_LOCK_TTL_MS), NOW)).toBe(true);
    expect(isLockStale(ago(EDIT_LOCK_TTL_MS * 4), NOW)).toBe(true);
  });

  it('reads a timestamp the adapter handed back as a string', () => {
    expect(isLockStale(ago(1000).toISOString(), NOW)).toBe(false);
  });
});

describe('isLockHeldByOther', () => {
  it('is not held when nobody claimed it', () => {
    expect(isLockHeldByOther(doc(null, null), 'me', NOW)).toBe(false);
  });

  it('is not held by me', () => {
    expect(isLockHeldByOther(doc('me', ago(1000)), 'me', NOW)).toBe(false);
  });

  it('is held by somebody else inside the TTL', () => {
    expect(isLockHeldByOther(doc('you', ago(1000)), 'me', NOW)).toBe(true);
  });

  it('is free again once their claim ages out', () => {
    expect(isLockHeldByOther(doc('you', ago(EDIT_LOCK_TTL_MS + 1)), 'me', NOW)).toBe(false);
  });

  it('is free when their claim carries no timestamp', () => {
    expect(isLockHeldByOther(doc('you', null), 'me', NOW)).toBe(false);
  });
});
