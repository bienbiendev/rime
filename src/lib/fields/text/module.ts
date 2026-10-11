import type { FieldHookDuplicate } from '#lib/fields/types.js';
import type { TextField } from './index.js';

/** The browser never duplicates: the value as it is. */
export const duplicateText: FieldHookDuplicate<TextField> = (value) => value;
