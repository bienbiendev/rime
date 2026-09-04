import type { Adapter } from '$lib/core/adapter/types.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { DocType, GenericDoc, RawDoc } from '$lib/core/prototype/types.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { saveBlocks } from './persist/blocks/index.server.js';
import { saveRelations } from './persist/relations/index.server.js';
import { saveTreeBlocks } from './persist/tree/index.server.js';
import type { Operation, OperationContext } from './types.js';

/**
 * The steps every document operation shares, written once.
 *
 * Collections and areas differ in how a document is addressed (an id vs. a singleton) and in
 * which adapter method writes it — not in the shape of the pipeline around that write. These
 * helpers hold that shape; the per-prototype operations in this folder supply the two or three
 * pieces that genuinely differ, as callbacks.
 *
 * Hook *ordering* is not decided here — see pipeline.server.ts.
 */

type AnyConfig = BuiltCollection | BuiltArea;
type AnyHook = (args: any) => Promise<any>;

/**
 * Runs the beforeOperation chain. These hooks see no document and no data — only the context,
 * which they may replace (authorize, for instance, reads it and throws).
 */
export const runBeforeOperation = async <S extends DocType>(args: {
  config: AnyConfig;
  event: RequestEvent;
  operation: Operation;
  context: OperationContext<S>;
}): Promise<OperationContext<S>> => {
  let context = args.context;

  for (const hook of (args.config.$hooks?.beforeOperation as AnyHook[]) || []) {
    const result = await hook({
      config: args.config,
      operation: args.operation,
      event: args.event,
      context
    });
    context = result.context;
  }

  return context;
};

/**
 * Runs a data-carrying chain (beforeCreate / beforeUpdate).
 *
 * All three of data, context and config travel through: a hook may rewrite the incoming data,
 * stash something on the context, or hand back an amended config — auth's augmentFieldsPassword
 * appends the password field this way, so the validation step below it sees it.
 *
 * Both timings chain all three, create included — a hook that amends the config on create has to
 * have that config reach the validation below it, or the policy it adds is never enforced.
 */
export const runDataHooks = async <S extends DocType, D, C extends AnyConfig>(args: {
  hooks: unknown;
  data: D;
  config: C;
  event: RequestEvent;
  operation: Operation;
  context: OperationContext<S>;
}): Promise<{ data: D; config: C; context: OperationContext<S> }> => {
  let { data, config, context } = args;

  for (const hook of (args.hooks as AnyHook[]) || []) {
    const result = await hook({
      data,
      config,
      operation: args.operation,
      event: args.event,
      context
    });
    context = result.context;
    data = result.data;
    config = result.config;
  }

  return { data, config, context };
};

/**
 * Runs a document-carrying chain (beforeRead / afterCreate / afterUpdate / beforeDelete /
 * afterDelete). `data` is passed through untouched for the after-upsert timings, which receive
 * both.
 */
export const runDocHooks = async <S extends DocType, T>(args: {
  hooks: unknown;
  doc: T;
  data?: unknown;
  config: AnyConfig;
  event: RequestEvent;
  operation: Operation;
  context: OperationContext<S>;
}): Promise<{ doc: T; context: OperationContext<S> }> => {
  let { doc, context } = args;

  for (const hook of (args.hooks as AnyHook[]) || []) {
    const result = await hook({
      doc,
      ...(args.data !== undefined ? { data: args.data } : {}),
      config: args.config,
      operation: args.operation,
      event: args.event,
      context
    });
    context = result.context;
    doc = result.doc;
  }

  return { doc, context };
};

/**
 * Asserts the context carries everything the write path needs by the time the before-hooks are
 * done. Each name is a hook that should have populated it, so a missing one points at the
 * pipeline entry that did not run.
 */
export const assertUpsertContext = (
  context: OperationContext<any>,
  where: string,
  required: readonly ('configMap' | 'originalConfigMap' | 'originalDoc' | 'versionOperation' | 'versionId')[]
) => {
  for (const name of required) {
    const present = name === 'versionId' ? context.params.versionId : context[name];
    if (!present) {
      throw new RimeError(RimeError.OPERATION_ERROR, `missing ${name} @${where}`);
    }
  }
};

/**
 * Writes a document's blocks, tree blocks and relations. Always these three, always in this
 * order — relations last, because it needs both diffs to resolve a relation that points at a
 * block or tree node created in the same pass.
 */
export const persistRelational = async (args: {
  context: OperationContext<any>;
  ownerId: string;
  data: Dic;
  incomingPaths: string[];
  adapter: Adapter;
  config: AnyConfig;
  locale?: string | undefined;
}) => {
  const { context, ownerId, data, incomingPaths, adapter, config, locale } = args;

  const blocksDiff = await saveBlocks({ context, ownerId, data, incomingPaths, adapter, config });
  const treeDiff = await saveTreeBlocks({ context, ownerId, data, incomingPaths, adapter, config });

  await saveRelations({
    ownerId,
    configMap: context.configMap!,
    data,
    incomingPaths,
    adapter,
    config,
    locale,
    blocksDiff,
    treeDiff
  });
};

/**
 * The read tail shared by findById and an area's find: turn a raw adapter row into a document,
 * then run the beforeRead chain over it.
 */
export const readDocument = async <S extends DocType, T extends GenericDoc>(args: {
  raw: RawDoc;
  config: AnyConfig;
  event: RequestEvent;
  context: OperationContext<S>;
  locale?: string | undefined;
  depth?: number;
  select?: string[];
}): Promise<{ doc: T; context: OperationContext<S> }> => {
  const { raw, config, event, locale, depth, select } = args;
  const hasSelect = !!select && Array.isArray(select) && !!select.length;

  const document = await event.locals.rime.adapter.transform.doc({
    doc: raw,
    slug: config.slug,
    locale,
    event,
    depth,
    withBlank: !hasSelect
  });

  return runDocHooks<S, T>({
    hooks: config.$hooks?.beforeRead,
    doc: document as T,
    config,
    event,
    operation: 'read',
    context: args.context
  });
};

/**
 * The update pipeline, prototype-parameterized.
 *
 * Collections and areas run exactly these eight steps in exactly this order; they differ only
 * in `write` (which adapter method persists the root row) and `reread` (how the saved document
 * is fetched back). Everything between — the hook chains, the context assertions, the
 * relational persistence — is identical, so it is written once.
 */
export const runUpdate = async <
  S extends DocType,
  T extends GenericDoc,
  C extends AnyConfig = AnyConfig
>(args: {
  data: Dic;
  config: C;
  event: RequestEvent;
  context: OperationContext<S>;
  where: string;
  /** Passed explicitly rather than read off the context, matching what both callers did. */
  locale?: string | undefined;
  /** Persists the root row. Returns whatever `reread` needs to find the document again. */
  write: (ctx: { data: Dic; config: C; context: OperationContext<S> }) => Promise<any>;
  /** Fetches the saved document back, for the afterUpdate hooks and the caller. */
  reread: (ctx: { written: any; config: C; context: OperationContext<S> }) => Promise<T>;
}): Promise<T> => {
  const { event, where } = args;

  // 1. beforeOperation
  let context = await runBeforeOperation<S>({
    config: args.config,
    event,
    operation: 'update',
    context: args.context
  });

  // 2. beforeUpdate — may rewrite data, context and config
  const beforeUpdate = await runDataHooks<S, Dic, C>({
    hooks: args.config.$hooks?.beforeUpdate,
    data: args.data,
    config: args.config,
    event,
    operation: 'update',
    context
  });
  const { data } = beforeUpdate;
  const config = beforeUpdate.config;
  context = beforeUpdate.context;

  // 3. the before-hooks must have populated all of these
  assertUpsertContext(context, where, [
    'configMap',
    'originalConfigMap',
    'originalDoc',
    'versionOperation',
    'versionId'
  ]);

  const incomingPaths = Object.keys(context.configMap!);

  // 4. write the root row
  const written = await args.write({ data, config, context });

  // 5. blocks, tree, relations
  await persistRelational({
    context,
    ownerId: context.params.versionId!,
    data,
    incomingPaths,
    adapter: event.locals.rime.adapter,
    config,
    locale: args.locale
  });

  // 6. read the saved document back
  const document = await args.reread({ written, config, context });

  // 7. afterUpdate
  const after = await runDocHooks<S, T>({
    hooks: config.$hooks?.afterUpdate,
    doc: document,
    data,
    config,
    event,
    operation: 'update',
    context
  });

  // 8. Return what afterUpdate handed back, matching afterCreate — an afterUpdate hook that
  // amends the document has to have that document reach the caller.
  return after.doc;
};
