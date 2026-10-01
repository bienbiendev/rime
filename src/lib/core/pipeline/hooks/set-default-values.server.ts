import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { getRequestEvent } from '$app/server';
import type { Adapter } from '$lib/core/adapter.js';
import type { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { isFormField } from '$lib/core/fields/util.js';
import { walkFields } from '$lib/core/fields/walk.js';
import { logger } from '$lib/core/logger.server.js';
import { isRelationField, type RelationFieldBuilder } from '$lib/fields/relation/index.js';
import { getValueAtPath, setValueAtPath } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import { buildConfigMap } from '../config-map/index.js';

/**
 * Gives an empty value its default on every save, for a field that says `fill: 'save'`: a value
 * sent empty and, on an update, a field not sent whose stored value is empty. Any other field
 * keeps what it was sent; a create gives a field not sent its default before this, in
 * `mergeWithInitialDocument`.
 *
 * ```ts
 * date('publishedAt').defaultValue(() => new Date(), { fill: 'save' });
 * // PATCH { publishedAt: null }   -> now
 * // PATCH {}, stored null          -> now
 * // PATCH {}, stored 2026-02-01    -> unchanged
 * ```
 *
 * It sits above `buildDataConfigMap`, so a field it adds is written. A relation's default is one
 * id or a list of them, and only the ids that name a document that exists survive — see
 * `defaultRelationValue`.
 */
export const setDefaultValues = Hooks.beforeUpsert(async function setDefaultValues(args) {
  const { operation, event } = args;
  const { rime } = event.locals;
  const fields = args.config.fields;
  const stored = operation === 'update' ? (args.context.originalDoc as Dic | undefined) : undefined;

  let output: Dic = { ...args.data };

  const fill = async (key: string, config: FormFieldBuilder) => {
    const value = await getDefaultValue({ key, config, adapter: rime.adapter });
    output = setValueAtPath(key, output, value);
  };

  // The values sent, blocks and tree items included: an empty one takes its default.
  for (const [key, config] of Object.entries(buildConfigMap(output, fields))) {
    if (config.get.defaultFill !== 'save') continue;
    if (isEmpty(config, key, getValueAtPath(key, output))) await fill(key, config);
  }

  // The fields not sent, outside blocks and tree items: an empty stored value takes its default.
  if (stored) {
    for (const { field, path } of walkFields(fields, { determinate: true })) {
      if (!isFormField(field) || field.get.defaultFill !== 'save') continue;
      if (getValueAtPath(path, output) !== undefined) continue;
      if (isEmpty(field, path, getValueAtPath(path, stored))) await fill(path, field);
    }
  }

  return { ...args, data: output };
});

/** A field's own `isEmpty`, and not empty when it throws. */
const isEmpty = (config: FormFieldBuilder, key: string, value: unknown) => {
  try {
    return config.use.isEmpty(value);
  } catch {
    logger.warn(`Error in config.isEmpty for field ${key}`);
    return false;
  }
};

type GetDefaultValue = (args: {
  key: string;
  config: FormFieldBuilder;
  adapter: Adapter;
}) => Promise<any>;

/**
 * A relation's default, as junction rows: the refs `use.defaultValue` answers, kept in their
 * order, those that name no document left out.
 */
const defaultRelationValue = async (
  config: RelationFieldBuilder,
  key: string,
  adapter: Adapter
) => {
  const refs = config.use.defaultValue({ event: getRequestEvent() });
  const ids = refs.map((ref) => ref.documentId);

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
  const found = new Set(existing.map(({ id }) => id));

  return ids
    .filter((id) => found.has(id))
    .map((documentId, position) => ({
      id: null,
      relationTo: config.get.relationTo,
      path: key,
      position,
      documentId
    }));
};

/** A relation's default becomes junction rows, checked against the collection. */
export const getDefaultValue: GetDefaultValue = async ({ key, config, adapter }) => {
  if (isRelationField(config)) {
    return await defaultRelationValue(config, key, adapter);
  }
  return config.use.defaultValue({ event: getRequestEvent() });
};
