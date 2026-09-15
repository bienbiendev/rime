import { blankFields } from '$lib/core/fields/blank.js';
import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import type { Field } from '$lib/fields/types.js';
import type { RequestEvent } from '@sveltejs/kit';

/** What `blank` reads off the config it is a method of. */
type BlankOwner = { fields: FieldBuilder<Field>[]; slug: string; type: string };

/**
 * A document of this config's shape with every default applied, and no id.
 *
 * ```ts
 * const page = config.getCollection('pages').blank();
 * ```
 *
 * Written as a standalone function so every config carries the same one — `definePrototype.create`
 * for an authored config, and the three derivations that build a config by hand. The event is a
 * field default's; boot has none, and a default that reads it gets `undefined` there.
 *
 * Nothing feature-shaped lands here: a feature adds to a blank document through
 * `FeatureDefinition.blank`, which the local API folds.
 */
export function blank(this: BlankOwner, event?: RequestEvent): GenericDoc {
  return {
    ...blankFields(this.fields, { event }),
    _type: this.slug,
    _prototype: this.type
  } as GenericDoc;
}
