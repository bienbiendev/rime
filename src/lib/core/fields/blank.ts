import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { Field } from '$lib/fields/types.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { isFormField } from './util.js';

/** What a field is handed to build its blank value. The event is a default's, and boot has none. */
export type BlankContext = { event?: RequestEvent };

/**
 * A list of fields as a blank object, each field contributing its own members.
 *
 * A branch opens an object, a leaf holds its default, and a repeater holds its own — `#` in a
 * segment means only a document can name the children.
 *
 * ```
 * group('attributes').fields(text('title'))   ->  { attributes: { title: null } }
 * tabs(tab('meta').fields(text('title')))     ->  { meta: { title: null } }
 * blocks('layout', [...])                     ->  { layout: [] }
 * ```
 */
export const blankFields = (fields: FieldBuilder<Field>[], context: BlankContext = {}): Dic => {
  const doc: Dic = {};

  for (const field of fields) {
    try {
      const nodes = field.use.nodes();

      if (!nodes.length || nodes.some((node) => node.segment.includes('#'))) {
        if (isFormField(field)) doc[field.name] = field.use.defaultValue(context) ?? null;
        continue;
      }

      // Its name opens an object, or it has none and its branches land on this one.
      const target = field.name ? (doc[field.name] = {} as Dic) : doc;
      for (const node of nodes) {
        const bucket = node.segment ? (target[node.segment] = {} as Dic) : target;
        Object.assign(bucket, blankFields(node.fields, context));
      }
    } catch (err) {
      console.error(`Building the blank value of ${field.type} field "${field.name}" failed.`);
      throw err;
    }
  }

  return doc;
};
