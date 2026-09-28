import { describe, expect, it } from 'vitest';
import { formatDay, greetingKey } from './time.js';

const now = new Date(2026, 8, 26, 15, 0, 0);

describe('greetingKey', () => {
  it('greets the morning from 5 to 11', () => {
    expect(greetingKey(5)).toBe('common.good_morning');
    expect(greetingKey(11)).toBe('common.good_morning');
  });

  it('greets the afternoon from 12 to 17', () => {
    expect(greetingKey(12)).toBe('common.good_afternoon');
    expect(greetingKey(17)).toBe('common.good_afternoon');
  });

  it('greets the evening from 18 to 4', () => {
    expect(greetingKey(18)).toBe('common.good_evening');
    expect(greetingKey(0)).toBe('common.good_evening');
    expect(greetingKey(4)).toBe('common.good_evening');
  });
});

describe('formatDay', () => {
  it('spells the day out, capitalized', () => {
    expect(formatDay(now, 'en')).toBe('Saturday, September 26');
    expect(formatDay(now, 'fr')).toBe('Samedi 26 septembre');
  });
});
