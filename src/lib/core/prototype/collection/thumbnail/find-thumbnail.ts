import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { walkFields } from '$lib/core/fields/walk.js';
import { RelationFieldBuilder } from '$lib/fields/relation/index.js';
import type { Field, FormField } from '$lib/fields/types.js';

interface ThumbnailFieldResult {
  field: FormFieldBuilder<FormField>;
  path: string;
}

/** The first relation marked `isThumbnail()`, at a path a config alone can name. */
export function findThumbnailField(
  fields: FieldBuilder<Field>[] = [],
  basePath: string = ''
): ThumbnailFieldResult | null {
  for (const { field, path } of walkFields(fields, { path: basePath, determinate: true })) {
    if (field instanceof RelationFieldBuilder && field.get.isThumbnail === true) {
      return { field, path };
    }
  }
  return null;
}
