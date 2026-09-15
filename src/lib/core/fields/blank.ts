import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { Field } from '$lib/fields/types.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';

/** What a field is handed to build its blank value. The event is a default's, and boot has none. */
export type BlankContext = { event?: RequestEvent };

/**
 * A list of fields as a blank object, each field contributing its own members.
 *
 * A field answers with the members it owns — one for a leaf, a nested object for a group, one per
 * tab for tabs — and a presentational field answers with nothing.
 */
export const blankFields = (fields: FieldBuilder<Field>[], context: BlankContext = {}): Dic =>
  fields.reduce((doc: Dic, field) => {
    try {
      return Object.assign(doc, field.use.blank(context));
    } catch (err) {
      console.error(`Building the blank value of ${field.type} field "${field.name}" failed.`);
      throw err;
    }
  }, {});
