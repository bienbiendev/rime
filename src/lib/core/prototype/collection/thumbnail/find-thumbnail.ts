import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { walkFields } from '#lib/core/fields/walk.js';
import { isRelationField } from '#lib/fields/relation/index.js';
import type { Field } from '#lib/fields/types.js';

/** The path of the first relation marked `isThumbnail()`, a path a config alone can name. */
export function findThumbnailField(fields: FieldBuilder<Field>[] = []): string | null {
  for (const { field, path } of walkFields(fields, { determinate: true })) {
    if (isRelationField(field) && field.get.isThumbnail === true) {
      return path;
    }
  }
  return null;
}
