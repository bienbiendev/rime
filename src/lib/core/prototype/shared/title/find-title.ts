import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { isFormField } from '#lib/core/fields/util.js';
import { walkFields } from '#lib/core/fields/walk.js';
import type { DateField } from '#lib/fields/date/index.js';
import type { EmailField } from '#lib/fields/email/index.js';
import type { SlugField } from '#lib/fields/slug/index.js';
import type { TextField } from '#lib/fields/text/index.js';
import type { Field, RichTextField } from '#lib/fields/types.js';

const hasMaybeTitle = (
  field: Field
): field is TextField | DateField | SlugField | EmailField | RichTextField =>
  ['text', 'date', 'slug', 'email', 'richText'].includes(field.type);

/** The path of the first field marked `isTitle()`, a path a config alone can name. */
export function findTitleField(fields: FieldBuilder<Field>[] = []): string | null {
  for (const { field, path } of walkFields(fields, { determinate: true })) {
    if (isFormField(field) && hasMaybeTitle(field.get) && field.get.isTitle === true) {
      return path;
    }
  }
  return null;
}
