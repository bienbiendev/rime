import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { isFormField } from '$lib/core/fields/util.js';
import { walkFields } from '$lib/core/fields/walk.js';
import type { DateField } from '$lib/fields/date/index.js';
import type { EmailField } from '$lib/fields/email/index.js';
import type { SlugField } from '$lib/fields/slug/index.js';
import type { TextField } from '$lib/fields/text/index.js';
import type { Field, FormField, RichTextField } from '$lib/fields/types.js';

export const hasMaybeTitle = (
  field: Field
): field is TextField | DateField | SlugField | EmailField | RichTextField =>
  ['text', 'date', 'slug', 'email', 'richText'].includes(field.type);

interface TitleFieldResult {
  field: FormFieldBuilder<FormField>;
  path: string;
}

/** The first field marked `isTitle()`, at a path a config alone can name. */
export function findTitleField(
  fields: FieldBuilder<Field>[] = [],
  basePath: string = ''
): TitleFieldResult | null {
  for (const { field, path } of walkFields(fields, { path: basePath, determinate: true })) {
    if (isFormField(field) && hasMaybeTitle(field.get) && field.get.isTitle === true) {
      return { field, path };
    }
  }
  return null;
}
