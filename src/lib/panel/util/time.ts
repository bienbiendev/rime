import { t__, type Translate } from '#lib/core/i18n/index.js';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Midnight of the day a date falls on, in milliseconds. */
const dayOf = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Calendar days from `then` to `now`. Math.round absorbs the hour a daylight-saving change adds
 * or removes between the two midnights. */
const daysBetween = (then: Date, now: Date) =>
  Math.round((dayOf(now) - dayOf(then)) / (DAY * 1000));

/**
 * Whether `formatWhen` writes `date` relative to `now`, `2 h ago` or `Yesterday`, rather than as
 * a date: within 7 calendar days.
 */
export const isRelative = (date: Date | string, now: Date) => daysBetween(new Date(date), now) < 7;

/**
 * How long ago a date was, short: relative within a week, the date after. Under 24 hours it
 * counts hours; past that, calendar days. An invalid date reads as ''.
 *
 * ```ts
 * formatWhen(twoHoursAgo, now, 'en') // '2 h ago'
 * formatWhen(yesterday, now, 'en')   // 'Yesterday'
 * formatWhen(lastMonth, now, 'en')   // 'Aug 12'
 * formatWhen(lastYear, now, 'en')    // 'Aug 12, 2025'
 * ```
 */
export function formatWhen(date: Date | string, now: Date, lang: string, t: Translate = t__) {
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return '';
  const seconds = Math.max(0, (now.getTime() - then.getTime()) / 1000);
  const days = daysBetween(then, now);

  if (seconds < MINUTE) return t('common.time_now');
  if (seconds < HOUR) return t('common.time_minutes_ago', String(Math.floor(seconds / MINUTE)));
  if (seconds < DAY) return t('common.time_hours_ago', String(Math.floor(seconds / HOUR)));
  // 0 on the 25-hour day of a daylight-saving change, 24 hours or more after its first hour
  if (days <= 1) return t('common.time_yesterday');
  if (isRelative(then, now)) return t('common.time_days_ago', String(days));

  const sameYear = then.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric'
  }).format(then);
}
