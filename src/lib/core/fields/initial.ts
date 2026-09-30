import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import type { Field, FormField } from '$lib/fields/types.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { isFormField } from './util.js';

/** What a field is handed to build its initial value. The event is a default's, and boot has none. */
export type InitialContext = { event?: RequestEvent };

/**
 * A list of fields as an object, each field contributing its own members, each leaf holding what
 * `leaf` gives it.
 *
 * A branch opens an object, a leaf holds its value, and a repeater is a leaf — `#` in a segment
 * means only a document can name the children.
 *
 * ```
 * group('attributes').fields(text('title'))   ->  { attributes: { title: … } }
 * tabs(tab('meta').fields(text('title')))     ->  { meta: { title: … } }
 * blocks('layout', [...])                     ->  { layout: … }
 * ```
 */
export const fieldValues = (
  fields: FieldBuilder<Field>[],
  leaf: (field: FormFieldBuilder<FormField>) => unknown
): Dic => {
  const doc: Dic = {};

  for (const field of fields) {
    try {
      const nodes = field.use.nodes();

      if (!nodes.length || nodes.some((node) => node.segment.includes('#'))) {
        if (isFormField(field)) doc[field.name] = leaf(field);
        continue;
      }

      // Its name opens an object, or it has none and its branches land on this one.
      const target = field.name ? (doc[field.name] = {} as Dic) : doc;
      for (const node of nodes) {
        const bucket = node.segment ? (target[node.segment] = {} as Dic) : target;
        Object.assign(bucket, fieldValues(node.fields, leaf));
      }
    } catch (err) {
      console.error(`Building the value of ${field.type} field "${field.name}" failed.`);
      throw err;
    }
  }

  return doc;
};

/**
 * What a new document, a new block or a new tree item starts with: each field's default, `null`
 * for a field without one.
 *
 * ```
 * text('title').defaultValue('Untitled'), text('slug')   ->  { title: 'Untitled', slug: null }
 * ```
 */
export const initialValues = (fields: FieldBuilder<Field>[], context: InitialContext = {}): Dic =>
  fieldValues(fields, (field) => field.use.defaultValue(context) ?? null);
