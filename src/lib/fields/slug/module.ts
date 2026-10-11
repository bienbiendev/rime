import type { FieldHookDuplicate } from '#lib/fields/types.js';
import type { SlugField } from './index.js';

/** The browser never duplicates: the value as it is. */
export const duplicateSlug: FieldHookDuplicate<SlugField> = (value) => value;
