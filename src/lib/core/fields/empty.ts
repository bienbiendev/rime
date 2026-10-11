import type { FieldBuilder } from '#lib/core/fields/builders/field-builder.js';
import type { Field } from '#lib/fields/types.js';
import {
  getValueAtPath,
  isObjectLiteral,
  omit,
  setValueAtPath,
  withDefaultValues
} from '#lib/util/object.js';
import type { Dic } from '#lib/util/types.js';
import { fieldValues } from './initial.js';
import { walkFields } from './walk.js';

/**
 * A block or tree row's own bookkeeping: where it sits and whose it is. A read hands it to the
 * panel only, so a row that lacks it is not completed with it.
 */
export const ROW_BOOKKEEPING = ['position', 'path', 'ownerId', 'locale'];

/** A field whose value is rows of their own table: blocks, tree items, relations. */
const isListField = (field: FieldBuilder) =>
  field.type === 'blocks' || field.type === 'tree' || field.type === 'relation';

/** `doc` with what `fields` declare and it lacks, added empty; a row leaves its bookkeeping out. */
const complete = (doc: Dic, fields: FieldBuilder<Field>[], isRow: boolean): Dic => {
  const empty = fieldValues(fields, (field) => (isListField(field) ? [] : null));
  let out = withDefaultValues(doc, isRow ? omit(ROW_BOOKKEEPING, empty) : empty);
  // Each block or tree item is completed with its own fields, like the document
  for (const { field, path } of walkFields(fields, { determinate: true })) {
    for (const row of field.use.nodesFor(getValueAtPath(path, out))) {
      if (!row.storage || !isObjectLiteral(row.value)) continue;
      // '3:hero' -> '3', '0._children.1' as is
      const at = `${path}.${row.segment.split(':')[0]}`;
      out = setValueAtPath(at, out, complete(row.value, row.fields, true));
    }
  }
  return out;
};

/**
 * The fields a document lacks, added empty: `[]` for blocks, tree and relations, `null` for the
 * others. A list with no rows has no key, so a read always lacks it. Each block and tree item is
 * completed the same way, with its own fields and without its bookkeeping.
 *
 * ```ts
 * withEmptyFields({ title: 'Home', sections: [{ type: 'hero' }] }, fields);
 * // { title: 'Home', sections: [{ type: 'hero', image: [] }], image: [] }
 * ```
 */
export const withEmptyFields = <T extends Dic>(doc: T, fields: FieldBuilder<Field>[]): T =>
  complete(doc, fields, false) as T;
