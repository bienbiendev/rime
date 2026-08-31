import { getRequestEvent } from '$app/server';
import type { Adapter } from '$lib/adapter-sqlite/index.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { logger } from '$lib/core/logger.server.js';
import { RelationFieldBuilder } from '$lib/fields/relation/index.js';
import { getValueAtPath, setValueAtPath } from '$lib/util/object.js';
import { eq, inArray } from 'drizzle-orm';
import { Hooks } from '$lib/core/factory/hooks.js';

export const setDefaultValues = Hooks.beforeUpsert(async (args) => {
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
    let condition;
    //@TODO encapsulate this into adapter.relation.something
    const relationTable = adapter.tables[config.get.relationTo];
    if (typeof defaultValue === 'string') {
      condition = eq(relationTable.id, defaultValue);
    } else if (Array.isArray(defaultValue)) {
      condition = inArray(relationTable.id, defaultValue);
    }
    const existing = (await adapter.db
      .select({ documentId: relationTable.id })
      .from(relationTable)
      .where(condition)) as { documentId: string }[];

    return existing.map(({ documentId }, index) => ({
      id: null,
      relationTo: config.get.relationTo,
      path: key,
      position: index,
      documentId: documentId
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
