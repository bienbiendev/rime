import type { Adapter } from '$lib/core/adapter.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import type { FeatureDefinition, WritePlan } from '$lib/core/features/define.js';
import { writePlanWithFeatures } from '$lib/core/features/fold.js';
import type { DocType, GenericDoc, PrototypeSlug, RawDoc } from '$lib/core/prototype/types.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import { buildDocument } from './build-document.server.js';
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
 * A `WritePlan` that has been through the update path, where a named content row is named.
 *
 * The shared type leaves `content.id` optional for inserts; `runUpdate` checks it once and hands
 * this down, so a `write` callback can pass the plan straight to `adapter.update`.
 */
export type UpdateWritePlan = WritePlan & { content?: { id: string; data: Dic } };

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
  required: readonly ('configMap' | 'originalConfigMap' | 'originalDoc' | 'contentOwnerId')[]
) => {
  for (const name of required) {
    const present = context[name];
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

  /**
   * Whose children these are, in slug space.
   *
   * All three writers asked `contentOwnerSlug(config)` for this — a helper in
   * `features/versions/naming.ts` that read `config.versions` and appended the feature's own
   * suffix. Three files in the pipeline importing a feature to name a table.
   *
   * Registration already answered it: `versions` is what the feature declared and the adapter was
   * handed at boot (stage 2), so the handle knows, and a second feature declaring a versions works
   * here with no change. `ownerId` is the row; this is the table it is in.
   *
   * The cast is the one `findManyPrototypes` takes, and sound for the same reason:
   * `VersionsTable.slug` is a plain `string` because a feature names a slug and only the
   * registry knows which exist — but a versions *is* a registered prototype, since the feature that
   * declares one also derives its config. `contentOwnerSlug` cast to `CollectionSlug` here too.
   */
  const ownerSlug = (adapter.prototype(config.slug).versions?.slug ?? config.slug) as PrototypeSlug;

  const blocksDiff = await saveBlocks({
    context,
    ownerId,
    ownerSlug,
    data,
    incomingPaths,
    adapter
  });
  const treeDiff = await saveTreeBlocks({
    context,
    ownerId,
    ownerSlug,
    data,
    incomingPaths,
    adapter
  });

  await saveRelations({
    ownerId,
    ownerSlug,
    configMap: context.configMap!,
    data,
    incomingPaths,
    adapter,
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

  const rows = await event.locals.rime.adapter.transform.rows({
    doc: raw,
    slug: config.slug,
    locale
  });

  const document = await buildDocument(rows, {
    config,
    event,
    locale,
    depth,
    withBlank: !hasSelect,
    /**
     * The panel edits blocks and tree nodes in place, so it needs each child row's own
     * bookkeeping — `position`, `path`, `ownerId`, `locale` — kept on it.
     *
     * The adapter used to work this out for itself, by testing `event.params.panel`. Core naming
     * the panel here is the last of that coupling (core letting go of `src/lib/panel/`), and it
     * is one line rather than four `if`s in the database layer. See docs/decoupling.md § 4.5.
     */
    withRowMeta: event.params.panel !== undefined
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
  /**
   * The features extending this prototype, for the write plan below. Handed down rather than
   * looked up: the pipeline importing the prototype registry would close a cycle.
   */
  features: FeatureDefinition[];
  /** Persists the write plan. Returns whatever `reread` needs to find the document again. */
  write: (ctx: { plan: UpdateWritePlan; config: C; context: OperationContext<S> }) => Promise<any>;
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
    'contentOwnerId'
  ]);

  const incomingPaths = Object.keys(context.configMap!);

  /**
   * 3.5. which rows this write touches, and with what.
   *
   * Here rather than in a hook, and that is the point of it: it has to run after *every* data
   * hook, and a hook cannot be guaranteed last — a consumer's `beforeUpdate` hook requires
   * `validated` and provides nothing, so no mark exists for a plan step to wait on. A consumer
   * hook that rewrote `data` would have been silently split around.
   *
   * The default is the whole story for a config with one row: everything goes on it. `versions`
   * is what refines it (features/versions/write-plan.ts), and it is why `versionOperation` no
   * longer travels to the adapter — the enum was only ever a way of saying which rows to write.
   */
  const plan = writePlanWithFeatures(
    args.features,
    { data },
    { config, context, operation: 'update' }
  );

  // `WritePlan.content.id` is optional because an *insert* has no row to name. An update does, so
  // the invariant is asserted here, once, rather than cast away at each of the two write sites.
  if (plan.content && !plan.content.id) {
    throw new RimeError(
      RimeError.OPERATION_ERROR,
      `the update plan for ${config.slug} names a content row with no id`
    );
  }

  const updatePlan = plan as UpdateWritePlan;

  // 4. write the rows the plan names
  const written = await args.write({ plan: updatePlan, config, context });

  // 5. blocks, tree, relations — against the row the content lives on
  await persistRelational({
    context,
    ownerId: context.contentOwnerId!,
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
