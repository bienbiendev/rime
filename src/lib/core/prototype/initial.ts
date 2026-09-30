import { initialValues } from '$lib/core/fields/initial.js';
import type { FieldBuilder } from '$lib/core/fields/builders/field-builder.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import type { Field } from '$lib/fields/types.js';
import type { RequestEvent } from '@sveltejs/kit';

/** What `initial` reads off the config it is a method of. */
type InitialOwner = { fields: FieldBuilder<Field>[]; slug: string; type: string };

/**
 * What a new document of this config starts with: every default applied, and no id.
 *
 * ```ts
 * const page = config.getCollection('pages').initial();
 * ```
 *
 * A standalone function, so every config carries the same one: `definePrototype.create` for an
 * authored config, and the three derivations that build a config by hand. The event is a field
 * default's; boot has none, and a default that reads it gets `undefined` there.
 */
export function initial(this: InitialOwner, event?: RequestEvent): GenericDoc {
  return {
    ...initialValues(this.fields, { event }),
    _type: this.slug,
    _prototype: this.type
  } as GenericDoc;
}
