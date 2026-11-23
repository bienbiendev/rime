import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import { isFormField } from '#lib/core/fields/util.js';
import { walkFields } from '#lib/core/fields/walk.js';
import type { DateField } from '#lib/fields/date/index.js';
import type { EmailField } from '#lib/fields/email/index.js';
import type { SlugField } from '#lib/fields/slug/index.js';
import type { TextField } from '#lib/fields/text/index.js';
import type { Field, RichTextField } from '#lib/fields/types.js';

/** The field types a title can be read from: text, date, slug, email and rich text. */
const hasMaybeTitle = (
  field: Field
): field is TextField | DateField | SlugField | EmailField | RichTextField =>
  ['text', 'date', 'slug', 'email', 'richText'].includes(field.type);

/** The first field marked `isTitle()`: its path, a path a config alone can name, and its mark. */
function findTitle(fields: FieldBuilder<Field>[]) {
  for (const { field, path } of walkFields(fields, { determinate: true })) {
    if (isFormField(field) && hasMaybeTitle(field.get) && field.get.isTitle) {
      return { path, isTitle: field.get.isTitle };
    }
  }
  return null;
}

/** The path of the first field marked `isTitle()`, a path a config alone can name. */
export function findTitleField(fields: FieldBuilder<Field>[] = []): string | null {
  return findTitle(fields)?.path ?? null;
}

/**
 * The path of the title the document's heading edits, `isTitle('inline')`, or `null`.
 *
 * ```ts
 * [tabs(tab('attributes').fields(text('title').isTitle('inline')))]  // 'attributes.title'
 * [text('title').isTitle()]                                           // null
 * ```
 */
export function findInlineTitle(fields: FieldBuilder<Field>[] = []): string | null {
  const title = findTitle(fields);
  return title?.isTitle === 'inline' ? title.path : null;
}
