import type { Config } from '$lib/core/config/types.js';
import type { FieldBuilder } from '$lib/core/fields/builders/index.js';
import type { Field } from '$lib/types.js';
import type { WithoutBuilders } from '$lib/util/types.js';

/**
 * Compile fields on the whole config for areaas and collections
 */
export function compileConfig<C extends Config>(config: C): WithoutBuilders<C> {
  return {
    ...config,
    collections: (config.collections || []).map(compileDocumentConfig),
    areas: (config.areas || []).map(compileDocumentConfig)
  } as WithoutBuilders<C>;
}

/**
 * Compile fields for the given area/collection
 * returns area/collections with compiled fields
 */
export const compileDocumentConfig = <T extends { fields: FieldBuilder[] }>(
  config: T
): WithoutBuilders<T> => {
  return {
    ...config,
    fields: compileFields(config.fields)
  } as WithoutBuilders<T>;
};

/**
 * Compile a list of fields and return it
 */
export const compileFields = (fields: FieldBuilder<Field>[]): Field[] => {
  return fields.map((f) => f.compile());
};
