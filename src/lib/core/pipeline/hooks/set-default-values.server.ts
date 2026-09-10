import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { getRequestEvent } from '$app/server';
import type { Adapter } from '$lib/core/adapter.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { logger } from '$lib/core/logger.server.js';
import { RelationFieldBuilder } from '$lib/fields/relation/index.js';
import { getValueAtPath, setValueAtPath } from '$lib/util/object.js';

/**
 * Fills in each field's `defaultValue` where the incoming data left it empty.
 *
 * A relation's default is one id or a list of them, and only the ids that name a document that
 * exists survive — see `defaultRelationValue`.
 */
export const setDefaultValues = Hooks.beforeUpsert(async function setDefaultValues(args) {
  const { operation, event } = args;
  const { rime } = event.locals;

  const configMap = args.context.configMap;

  if (!configMap)
    throw new RimeError(RimeError.OPERATION_ERROR, 'missing configMap @setDefaultValues');

  let output = { ...args.data };
  for (const [key, config] of Object.entries(configMap)) {
    let value = getValueAtPath(key, output);

    let isEmpty;
    const shouldAddDefault =
      operation === 'create' || (operation === 'update' && config.get.required);

    try {
      isEmpty = config.use.isEmpty(value);
    } catch {
      isEmpty = false;
      logger.warn(`Error in config.isEmpty for field ${key}`);
    }
    if (shouldAddDefault && isEmpty && config.get.defaultValue !== undefined) {
      value = await getDefaultValue({ key, config, adapter: rime.adapter });
      output = setValueAtPath(key, output, value);
    }
  }

  return {
    ...args,
    data: output
  };
});

type GetDefaultValue = (args: {
  key: string;
  config: FormFieldBuilder;
  adapter: Adapter;
}) => Promise<any>;

/**
 * This function convert any default value string | string[] of ids
 * to a RelationValue from an existing relation record
 */
const defaultRelationValue = async (
  config: RelationFieldBuilder,
  key: string,
  adapter: Adapter
) => {
  const buildRelation = async (defaultValue: any) => {
    // A default relation is one id or a list of them. Anything else names no document, and must
    // not fall through to a `where(undefined)` that would hand back every row in the collection.
    const ids =
      typeof defaultValue === 'string'
        ? [defaultValue]
        : Array.isArray(defaultValue)
          ? defaultValue
          : [];

    // `existingIds` on the adapter, written out: which of these ids name a document that exists.
    // The ordinary read, projected — see collection/nested/hooks/add-children.server.ts.
    //
    // `relationTo` is typed `CollectionSlug` by `RelationFieldBuilder.to`, so a relation names a
    // collection by construction.
    const existing = ids.length
      ? await adapter
          .collection(config.get.relationTo)
          .findMany({ query: { where: { id: { in_array: ids } } }, select: ['id'] })
      : [];

    return existing.map(({ id: documentId }, index) => ({
      id: null,
      relationTo: config.get.relationTo,
      path: key,
      position: index,
      documentId
    }));
  };

  return await buildRelation(config.use.defaultValue({ event: getRequestEvent() }));
};

export const getDefaultValue: GetDefaultValue = async ({ key, config, adapter }) => {
  if (config instanceof RelationFieldBuilder) {
    return await defaultRelationValue(config, key, adapter);
  }
  return config.use.defaultValue({ event: getRequestEvent() });
};
