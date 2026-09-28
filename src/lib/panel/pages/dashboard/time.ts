import { capitalize } from '$lib/util/string.js';

/**
 * The greeting key for an hour of the day.
 *
 * ```ts
 * greetingKey(9)   // 'common.good_morning'    5 to 11
 * greetingKey(15)  // 'common.good_afternoon'  12 to 17
 * greetingKey(22)  // 'common.good_evening'    18 to 4
 * ```
 */
export function greetingKey(hour: number) {
  if (hour >= 5 && hour < 12) return 'common.good_morning';
  if (hour >= 12 && hour < 18) return 'common.good_afternoon';
  return 'common.good_evening';
}

/**
 * The day, spelled out, capitalized.
 *
 * ```ts
 * formatDay(now, 'en')  // 'Saturday, September 26'
 * formatDay(now, 'fr')  // 'Samedi 26 septembre'
 * ```
 */
export function formatDay(date: Date, lang: string) {
  const day = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  return capitalize(day.format(date));
}
