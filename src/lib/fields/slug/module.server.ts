import { freeValue } from '#lib/core/fields/unique.server.js';
import type { FieldHookDuplicate } from '#lib/fields/types.js';
import type { SlugField } from './index.js';

const nextCopy = (source: string, n: number) =>
  n === 1 ? `${source}-copy` : `${source}-copy-${n}`;

/**
 * A slug on a copy: a title gets `-copy`, a unique slug the first free `-copy-n`. An empty slug
 * stays empty.
 *
 * ```ts
 * // slug('slug').unique(), 'sale' taken
 * await duplicateSlug('sale', context); // 'sale-copy'
 * ```
 */
export const duplicateSlug: FieldHookDuplicate<SlugField> = async (value, context) => {
  const { isTitle, unique } = context.config;
  if (isTitle && value) value = nextCopy(value, 1);
  if (unique) value = await freeValue(value, context, nextCopy);
  return value;
};
