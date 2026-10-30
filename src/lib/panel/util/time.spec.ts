import { createI18n } from '#lib/core/i18n/index.js';
import en from '#lib/core/i18n/en/common.js';
import fr from '#lib/core/i18n/fr/common.js';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { formatWhen, isRelative } from './time.js';

const now = new Date(2026, 8, 26, 15, 0, 0);
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);
const { t__: english } = createI18n({ common: en });
const { t__: french } = createI18n({ common: fr });

describe('formatWhen', () => {
  it('says now under a minute', () => {
    expect(formatWhen(ago(20), now, 'en', english)).toBe('Just now');
  });

  it('counts minutes, then hours', () => {
    expect(formatWhen(ago(5 * 60), now, 'en', english)).toBe('5 min ago');
    expect(formatWhen(ago(2 * 3600), now, 'en', english)).toBe('2 h ago');
    expect(formatWhen(ago(2 * 3600), now, 'fr', french)).toBe('Il y a 2 h');
  });

  it('counts days within a week', () => {
    expect(formatWhen(ago(30 * 3600), now, 'en', english)).toBe('Yesterday');
    expect(formatWhen(ago(30 * 3600), now, 'fr', french)).toBe('Hier');
    expect(formatWhen(ago(3 * 86400), now, 'en', english)).toBe('3 d ago');
    expect(formatWhen(ago(3 * 86400), now, 'fr', french)).toBe('Il y a 3 j');
  });

  it('counts calendar days past 24 hours', () => {
    // Monday 23:00 to Wednesday 08:00: 33 hours, two midnights
    const wednesday = new Date(2026, 8, 30, 8, 0, 0);
    expect(formatWhen(new Date(2026, 8, 28, 23, 0, 0), wednesday, 'en', english)).toBe('2 d ago');
  });

  it('says yesterday 24 hours or more ago on the 25-hour day of a daylight-saving change', () => {
    vi.stubEnv('TZ', 'Europe/Paris');
    onTestFinished(() => {
      vi.unstubAllEnvs();
    });
    // Paris goes from 03:00 back to 02:00 on October 25, 2026: 00:10 to 23:50 is 24 h 40 min
    const night = new Date(2026, 9, 25, 23, 50, 0);
    expect(formatWhen(new Date(2026, 9, 25, 0, 10, 0), night, 'en', english)).toBe('Yesterday');
  });

  it('gives the date at 7 calendar days, under 7 × 24 hours, and isRelative agrees', () => {
    // Monday 23:00 to the next Monday 08:00: 6 days 9 hours, 7 midnights
    const saved = new Date(2026, 8, 28, 23, 0, 0);
    const nextMonday = new Date(2026, 9, 5, 8, 0, 0);
    expect(formatWhen(saved, nextMonday, 'en', english)).toBe('Sep 28');
    expect(isRelative(saved, nextMonday)).toBe(false);
    expect(isRelative(ago(3 * 86400), now)).toBe(true);
  });

  it('reads an invalid date as empty', () => {
    expect(formatWhen('not a date', now, 'en', english)).toBe('');
  });

  it('gives the date after a week, with the year when it differs', () => {
    expect(formatWhen(new Date(2026, 8, 12), now, 'en', english)).toBe('Sep 12');
    expect(formatWhen(new Date(2025, 7, 12), now, 'en', english)).toBe('Aug 12, 2025');
  });

  it('reads a date string, and a date ahead as now', () => {
    expect(formatWhen(ago(2 * 3600).toISOString(), now, 'en', english)).toBe('2 h ago');
    expect(formatWhen(ago(-600), now, 'en', english)).toBe('Just now');
  });
});
