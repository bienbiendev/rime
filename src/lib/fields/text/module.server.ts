import { freeValue } from '#lib/core/fields/unique.server.js';
import type { FieldHookDuplicate } from '#lib/fields/types.js';
import type { TextField } from './index.js';

const nextCopy = (source: string, n: number) =>
  n === 1 ? `${source} (copy)` : `${source} (copy ${n})`;

/**
 * A text on a copy: a title gets ` (copy)`, a unique text the first free `(copy n)`. An empty
 * title stays empty.
 *
 * ```ts
 * // text('title').isTitle().unique(), 'Sale' and 'Sale (copy)' taken
 * await duplicateText('Sale', context); // 'Sale (copy 2)'
 * ```
 */
export const duplicateText: FieldHookDuplicate<TextField> = async (value, context) => {
  const { isTitle, unique } = context.config;
  if (isTitle && value) value = nextCopy(value, 1);
  if (unique) value = await freeValue(value, context, nextCopy);
  return value;
};
