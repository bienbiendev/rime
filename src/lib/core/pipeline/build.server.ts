import type { Dic } from '#lib/util/types.js';
import { areaHooks } from '../prototype/area/hooks.server.js';
import { collectionHooks } from '../prototype/collection/hooks.server.js';
import { sortDocumentProps } from './hooks/sort-document-props.server.js';
import type { AnyHook, HookTiming } from './types.js';

/** A prototype's own hooks, by timing, in the order they run. */
type HookLists = Partial<Record<HookTiming, AnyHook[]>>;

/** Every timing a pipeline can carry. A prototype declares nothing for the ones it has no use
 *  for — an area has no create or delete. */
const TIMINGS: HookTiming[] = [
  'beforeOperation',
  'beforeRead',
  'beforeCreate',
  'afterCreate',
  'beforeUpdate',
  'afterUpdate',
  'beforeDelete',
  'afterDelete'
];

/**
 * Composes one config's pipeline out of the two layers that contribute to it, and orders it.
 *
 * **The list order is the run order**, and that is the whole of it. Whether a hook applies to this
 * config is the guard beside it in the list — `when(isAuth, …)` — so all this adds is the
 * consumer's own hooks and the finaliser.
 */
const buildPipeline = (hooks: HookLists, consumer: Dic | undefined): Dic => {
  const pipeline: Dic = {};

  for (const timing of TIMINGS) {
    pipeline[timing] = [
      // Every placed hook. Which of them *applies* to this config is the guard beside it in the
      // list — `when(isAuth, …)` — asked when the hook runs rather than filtered here, so a
      // config and its pipeline are the same list.
      ...(hooks[timing] ?? []),
      // A consumer's hooks are appended. They cannot interleave with the placed ones, which is
      // the cost of a written order.
      ...((consumer?.[timing] as unknown[]) ?? []),
      /**
       * And then the finaliser, after everything including the consumer's.
       *
       * `sortDocumentProps` is not a participant — nothing may precede it and nothing may follow,
       * so it is appended rather than placed. In no list, because a list is for things whose
       * position is a choice.
       */
      ...(timing === 'beforeRead' ? [sortDocumentProps] : [])
    ];
  }

  return pipeline;
};

/** One config, with its `$hooks` resolved: the authored hooks going in, the pipeline coming out. */
const augmentHooks = <T extends Dic>(hooks: HookLists, config: T): T & { $hooks: Dic } => ({
  ...config,
  $hooks: buildPipeline(hooks, config.$hooks as Dic | undefined)
});

/**
 * Resolves every prototype config's pipeline, once the whole config exists.
 *
 * The last step of the config chain, and the only place a pipeline is built. Every derived config
 * exists by then (upload's `<slug>Directories`, versions' version tables), so each one is resolved
 * the same way: the prototype's hooks (`collectionHooks`, `areaHooks`) and the author's `$hooks`.
 */
export const resolvePipelines = <T extends Dic>(config: T): T => {
  const resolve = (hooks: HookLists, configs: unknown): Dic[] =>
    ((configs as Dic[] | undefined) ?? []).map((c) => augmentHooks(hooks, c));

  return {
    ...config,
    collections: resolve(collectionHooks, config.collections),
    areas: resolve(areaHooks, config.areas)
  } as T;
};
