import type { PrototypeDefinition } from '$lib/core/prototype/define.js';
import type { Dic } from '$lib/util/types.js';
import { areaHooks } from '../prototype/area/hooks.server.js';
import { collectionHooks } from '../prototype/collection/hooks.server.js';
import { sortDocumentProps } from './hooks/sort-document-props.server.js';
import type { HookTiming } from './types.js';

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
const buildPipeline = (
  definition: Pick<PrototypeDefinition, 'hooks'>,
  config: Dic,
  consumer: Dic | undefined
): Dic => {
  const pipeline: Dic = {};

  for (const timing of TIMINGS) {
    pipeline[timing] = [
      // A hook belonging to a feature runs only where that feature is enabled; a hook belonging
      // to none is the prototype's own and always runs.
      // Every placed hook. Which of them *applies* to this config is the guard beside it in the
      // list — `when(isAuth, …)` — asked when the hook runs rather than filtered here, so a
      // config and its pipeline are the same list.
      ...(definition.hooks?.[timing] ?? []),
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
export const augmentHooks = <T extends Dic>(
  definition: Pick<PrototypeDefinition, 'hooks'>,
  config: T
): T & { $hooks: Dic } => ({
  ...config,
  $hooks: buildPipeline(definition, config, config.$hooks as Dic | undefined)
});

/**
 * Resolves every prototype config's pipeline, once the whole config exists.
 *
 * The **last** step of the config chain, and the only place a pipeline is built. By the time it
 * runs, the features have derived whatever they derive — upload's `<slug>Directories`, versions'
 * version tables — so a derived config is resolved by the same line as an authored one, from the same
 * three inputs: the prototype's own hooks, the hooks of the features this config enables, and the
 * author's `$hooks`.
 *
 * That is why nothing carries a second copy of anything: a config derived before this runs never
 * has a pipeline to inherit, and never needs one rebuilt.
 *
 * Each prototype's `features` comes off its **isomorphic** half and its hooks from the
 * `hooks.server.ts` beside it — never through `definition.server.ts`, which spreads `{ ...base }`
 * at module scope. See rule 3 in CONTRIBUTING.md; the failure has no symptom but a missing title.
 */
export const resolvePipelines = <T extends Dic>(config: T): T => {
  const resolve = (definition: Pick<PrototypeDefinition, 'hooks'>, configs: unknown): Dic[] =>
    ((configs as Dic[] | undefined) ?? []).map((c) => augmentHooks(definition, c));

  return {
    ...config,
    collections: resolve({ hooks: collectionHooks }, config.collections),
    areas: resolve({ hooks: areaHooks }, config.areas)
  } as T;
};
