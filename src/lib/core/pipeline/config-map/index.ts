import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import { isFormField } from '$lib/core/fields/util.js';
import { walkValues } from '$lib/core/fields/walk.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import type { Field } from '$lib/fields/types.js';
import { normalizeFieldPath } from '$lib/util/string.js';
import type { DeepPartial } from '$lib/util/types.js';
import type { ConfigMap } from './types.js';

/**
 * Every field a document carries, keyed by the path its value sits at.
 *
 * The keys are the on-disk path format, so the block type the walk names is stripped:
 *
 * ```
 * layout.0:hero.title -> layout.0.title
 * ```
 */
export const buildConfigMap = (
  data: DeepPartial<GenericDoc>,
  incomingFields: FieldBuilder<Field>[]
): ConfigMap => {
  const map: ConfigMap = {};
  for (const { field, path } of walkValues(incomingFields, data)) {
    if (isFormField(field)) map[normalizeFieldPath(path)] = field;
  }
  return map;
};
