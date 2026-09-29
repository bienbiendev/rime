import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import { slugify } from '$lib/util/string.js';

/**
 * A page's url: `$url` with its path, slug, locale and document, made absolute against
 * `PUBLIC_RIME_URL`.
 *
 * ```ts
 * formatUrl({ config, doc, path: 'services/web', locale: 'en' }) // 'https://site.test/en/services/web'
 * formatUrl({ config, doc, path: '', locale: '' })                // an area: no path, no slug
 * ```
 */
export const formatUrl = (args: {
  config: BuiltCollection | BuiltArea;
  doc: GenericDoc;
  path: string;
  locale: string;
}): string => {
  const { config, doc, path, locale } = args;
  const segments = path ? path.split('/') : [];
  const url: unknown = config.$url!({ path: segments, slug: segments.at(-1) ?? '', locale, doc });
  if (typeof url !== 'string') {
    throw new RimeError(RimeError.CONFIG_ERROR, `$url of ${config.slug} must answer a string`);
  }
  const origin = process.env.PUBLIC_RIME_URL;
  return origin ? new URL(url, origin).href : url;
};

/** A slug made from any text: `'Web design!'` -> `'web-design'`. Empty when nothing is left. */
export const toSlug = (text: unknown) => slugify(String(text ?? '')).replace(/^-+|-+$/g, '');

/**
 * `wanted`, or the first of `wanted-2`, `wanted-3`… that no sibling holds.
 *
 * ```ts
 * freeSlug('web', ['web', 'web-2']) // 'web-3'
 * ```
 */
export const freeSlug = (wanted: string, taken: string[]) => {
  if (!taken.includes(wanted)) return wanted;
  let n = 2;
  while (taken.includes(`${wanted}-${n}`)) n++;
  return `${wanted}-${n}`;
};
