import { t__, type Translate } from '$lib/core/i18n/index.js';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * How long ago a date was, short: relative within a week, the date after.
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
  const seconds = Math.max(0, (now.getTime() - then.getTime()) / 1000);

  if (seconds < MINUTE) return t('common.time_now');
  if (seconds < HOUR) return t('common.time_minutes_ago', String(Math.floor(seconds / MINUTE)));
  if (seconds < DAY) return t('common.time_hours_ago', String(Math.floor(seconds / HOUR)));
  if (seconds < 2 * DAY) return t('common.time_yesterday');
  if (seconds < WEEK) return t('common.time_days_ago', String(Math.floor(seconds / DAY)));

  const sameYear = then.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric'
  }).format(then);
}
