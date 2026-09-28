import { createI18n } from '$lib/core/i18n/index.js';
import en from '$lib/core/i18n/en/common.js';
import fr from '$lib/core/i18n/fr/common.js';
import { describe, expect, it } from 'vitest';
import { formatWhen } from './time.js';

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

  it('gives the date after a week, with the year when it differs', () => {
    expect(formatWhen(new Date(2026, 8, 12), now, 'en', english)).toBe('Sep 12');
    expect(formatWhen(new Date(2025, 7, 12), now, 'en', english)).toBe('Aug 12, 2025');
  });

  it('reads a date string, and a date ahead as now', () => {
    expect(formatWhen(ago(2 * 3600).toISOString(), now, 'en', english)).toBe('2 h ago');
    expect(formatWhen(ago(-600), now, 'en', english)).toBe('Just now');
  });
});
