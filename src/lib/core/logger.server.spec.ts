import { afterAll, describe, expect, it } from 'vitest';
import { isExpired, retentionDays } from './logger.server.js';

// West of UTC, where a day's file read as UTC midnight looked a day old by the evening. Put back
// after, since the worker may run other files.
const tz = process.env.TZ;
process.env.TZ = 'America/New_York';
afterAll(() => {
  if (tz === undefined) delete process.env.TZ;
  else process.env.TZ = tz;
});

describe('isExpired', () => {
  it("keeps today's file until the day ends", () => {
    const evening = new Date(2026, 9, 3, 21, 0);
    expect(isExpired('2026-10-03.log', evening, 1)).toBe(false);
    expect(isExpired('2026-10-02.log', evening, 1)).toBe(true);
  });

  it('keeps today and the 29 days before for thirty days', () => {
    const now = new Date(2026, 9, 3, 9, 0);
    expect(isExpired('2026-09-04.log', now, 30)).toBe(false);
    expect(isExpired('2026-09-03.log', now, 30)).toBe(true);
  });

  it('counts a day across a daylight-saving change as one day', () => {
    // New York leaves daylight saving on 2026-11-01: that day lasts 25 hours
    const now = new Date(2026, 10, 2, 0, 30);
    expect(isExpired('2026-11-01.log', now, 2)).toBe(false);
    expect(isExpired('2026-10-31.log', now, 2)).toBe(true);
  });

  it('never deletes a file not named after a day', () => {
    expect(isExpired('notes.log', new Date(), 1)).toBe(false);
    expect(isExpired('2026-10-03.txt', new Date(2026, 11, 1), 1)).toBe(false);
  });
});

describe('retentionDays', () => {
  it('keeps thirty days for 0, an empty value or anything not a number', () => {
    const now = new Date(2026, 9, 3, 9, 0);
    for (const maxDays of [0, Number(''), NaN, -1]) {
      expect(isExpired('2026-10-02.log', now, retentionDays(maxDays))).toBe(false);
      expect(isExpired('2026-09-02.log', now, retentionDays(maxDays))).toBe(true);
    }
  });

  it('keeps the days asked for', () => {
    expect(retentionDays(7)).toBe(7);
  });
});
