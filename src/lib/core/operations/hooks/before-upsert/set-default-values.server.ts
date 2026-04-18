import { getRequestEvent } from '$app/server';
import type { Adapter } from '$lib/adapter-sqlite/index.server.js';
import { RimeError } from '$lib/core/errors/index.js';
import { logger } from '$lib/core/logger/index.server.js';
import { isRelationField } from '$lib/fields/relation/index.js';
import type { FormField, RelationField } from '$lib/fields/types.js';
import { getValueAtPath, hasProp, setValueAtPath } from '$lib/util/object.js';
import { eq, inArray } from 'drizzle-orm';
import { Hooks } from '../index.server.js';

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
    const shouldAddDefault = operation === 'create' || (operation === 'update' && config.required);

    try {
      isEmpty = config.isEmpty(value);
    } catch {
      isEmpty = false;
      logger.warn(`Error in config.isEmpty for field ${key}`);
    }
    if (shouldAddDefault && isEmpty && hasProp('defaultValue', config)) {
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
  config: FormField & { defaultValue: any };
  adapter: Adapter;
}) => Promise<any>;

/**
 * This function convert any default value string | string[] of ids
 * to a RelationValue from an existing relation record
 */
const defaultRelationValue = async (config: RelationField, key: string, adapter: Adapter) => {
  const buildRelation = async (defaultValue: any) => {
    let condition;
    //@TODO encapsulate this into adapter.relation.something
    const relationTable = adapter.tables[config.relationTo];
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
      relationTo: config.relationTo,
      path: key,
      position: index,
      documentId: documentId
    }));
  };

  return await buildRelation(config.defaultValue);
};

export const getDefaultValue: GetDefaultValue = async ({ key, config, adapter }) => {
  if (isRelationField(config)) {
    return await defaultRelationValue(config, key, adapter);
  } else {
    if (typeof config.defaultValue === 'function') {
      return config.defaultValue({ event: getRequestEvent() });
    }
    return config.defaultValue;
  }
};
