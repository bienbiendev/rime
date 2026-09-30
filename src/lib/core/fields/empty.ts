import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { Field } from '$lib/fields/types.js';
import { withDefaultValues } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import { fieldValues } from './initial.js';

/** A field whose value is rows of their own table: blocks, tree items, relations. */
export const isListField = (field: FieldBuilder) =>
  field.type === 'blocks' || field.type === 'tree' || field.type === 'relation';

/**
 * The fields a document lacks, added empty: `[]` for blocks, tree and relations, `null` for the
 * others. A list with no rows has no key, so a read always lacks it.
 *
 * ```ts
 * withEmptyFields({ title: 'Home' }, fields); // { title: 'Home', sections: [], image: [] }
 * ```
 */
export const withEmptyFields = <T extends Dic>(doc: T, fields: FieldBuilder<Field>[]): T =>
  withDefaultValues(
    doc,
    fieldValues(fields, (field) => (isListField(field) ? [] : null))
  );
