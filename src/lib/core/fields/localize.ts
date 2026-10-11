import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import type { Field } from '#lib/fields/types.js';

/** A builder that can be marked localized: a form field, or a container of them such as tabs. */
type Localizable = FieldBuilder<Field> & {
  clone(): Localizable;
  localized(): Localizable;
};

const isLocalizable = (field: FieldBuilder<Field>): field is Localizable =>
  'localized' in field &&
  typeof field.localized === 'function' &&
  'clone' in field &&
  typeof field.clone === 'function';

/**
 * `fields` with each one that can be localized replaced by a localized clone, so a field shared
 * with another config stays as it is. `keep` names the members left as they are.
 *
 * ```ts
 * localizeFields([text('label'), tabs(tab('seo').fields(text('title')))]);
 * // label and seo.title localized
 * ```
 */
export const localizeFields = (fields: FieldBuilder<Field>[], keep: string[] = []) =>
  fields.map((field) =>
    !keep.includes(field.name) && isLocalizable(field) ? field.clone().localized() : field
  );
